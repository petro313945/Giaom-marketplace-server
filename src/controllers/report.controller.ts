import { Response } from 'express';
import Report from '../models/Report';
import Product from '../models/Product';
import User from '../models/User';
import Review from '../models/Review';
import { AuthRequest } from '../middleware/auth.middleware';

// Submit a report
export const submitReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { reportedType, reportedId, reason, description } = req.body;

    // Validate required fields
    if (!reportedType || !['product', 'user', 'review'].includes(reportedType)) {
      res.status(400).json({ error: 'Invalid report type. Must be product, user, or review' });
      return;
    }

    if (!reportedId) {
      res.status(400).json({ error: 'Reported ID is required' });
      return;
    }

    if (!reason || reason.trim().length === 0) {
      res.status(400).json({ error: 'Report reason is required' });
      return;
    }

    // Validate that the reported content exists
    let reportedContent;
    switch (reportedType) {
      case 'product':
        reportedContent = await Product.findById(reportedId);
        if (!reportedContent) {
          res.status(404).json({ error: 'Product not found' });
          return;
        }
        // Prevent users from reporting their own products
        if (reportedContent.sellerId.toString() === req.user._id.toString()) {
          res.status(400).json({ error: 'You cannot report your own product' });
          return;
        }
        break;
      case 'user':
        reportedContent = await User.findById(reportedId);
        if (!reportedContent) {
          res.status(404).json({ error: 'User not found' });
          return;
        }
        // Prevent users from reporting themselves
        if (reportedContent._id.toString() === req.user._id.toString()) {
          res.status(400).json({ error: 'You cannot report yourself' });
          return;
        }
        break;
      case 'review':
        reportedContent = await Review.findById(reportedId);
        if (!reportedContent) {
          res.status(404).json({ error: 'Review not found' });
          return;
        }
        // Prevent users from reporting their own reviews
        if (reportedContent.userId.toString() === req.user._id.toString()) {
          res.status(400).json({ error: 'You cannot report your own review' });
          return;
        }
        break;
    }

    // Check if user has already reported this content
    const existingReport = await Report.findOne({
      reporterId: req.user._id,
      reportedType,
      reportedId
    });

    if (existingReport) {
      res.status(400).json({ 
        error: 'You have already reported this content',
        report: {
          id: existingReport._id,
          status: existingReport.status,
          createdAt: existingReport.createdAt
        }
      });
      return;
    }

    // Create report
    const report = await Report.create({
      reporterId: req.user._id,
      reportedType,
      reportedId,
      reason: reason.trim(),
      description: description?.trim() || '',
      status: 'pending'
    });

    // Populate reporter info
    await report.populate('reporterId', 'email fullName');

    res.status(201).json({
      message: 'Report submitted successfully',
      report: {
        id: report._id,
        reporterId: report.reporterId,
        reportedType: report.reportedType,
        reportedId: report.reportedId,
        reason: report.reason,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt
      }
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'You have already reported this content' });
      return;
    }
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid ID format' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to submit report' });
  }
};

// Get all reports (admin only)
export const getAllReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    // Build query
    const query: any = {};
    if (status && ['pending', 'resolved', 'dismissed'].includes(status)) {
      query.status = status;
    }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate('reporterId', 'email fullName')
        .populate('resolvedBy', 'email fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(query)
    ]);

    // Populate reported content based on type
    const reportsWithContent = await Promise.all(
      reports.map(async (report) => {
        let reportedContent = null;
        try {
          switch (report.reportedType) {
            case 'product':
              reportedContent = await Product.findById(report.reportedId)
                .populate('sellerId', 'email fullName')
                .select('title description price category imageUrl imageUrls status');
              break;
            case 'user':
              reportedContent = await User.findById(report.reportedId)
                .select('email fullName role');
              break;
            case 'review':
              reportedContent = await Review.findById(report.reportedId)
                .populate('userId', 'email fullName')
                .populate('productId', 'title')
                .select('rating comment status');
              break;
          }
        } catch (error) {
          // If content was deleted, reportedContent will be null
          console.error(`Failed to populate reported content for report ${report._id}:`, error);
        }

        return {
          id: report._id,
          reporterId: report.reporterId,
          reportedType: report.reportedType,
          reportedId: report.reportedId,
          reportedContent,
          reason: report.reason,
          description: report.description,
          status: report.status,
          adminNotes: report.adminNotes,
          resolvedBy: report.resolvedBy,
          resolvedAt: report.resolvedAt,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt
        };
      })
    );

    res.json({
      reports: reportsWithContent,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get reports' });
  }
};

// Get pending reports count (admin only)
export const getPendingReportsCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const count = await Report.countDocuments({ status: 'pending' });

    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get pending reports count' });
  }
};

// Get single report (admin only)
export const getReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;

    const report = await Report.findById(id)
      .populate('reporterId', 'email fullName')
      .populate('resolvedBy', 'email fullName');

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // Populate reported content
    let reportedContent = null;
    try {
      switch (report.reportedType) {
        case 'product':
          reportedContent = await Product.findById(report.reportedId)
            .populate('sellerId', 'email fullName')
            .select('title description price category imageUrl imageUrls status');
          break;
        case 'user':
          reportedContent = await User.findById(report.reportedId)
            .select('email fullName role');
          break;
        case 'review':
          reportedContent = await Review.findById(report.reportedId)
            .populate('userId', 'email fullName')
            .populate('productId', 'title')
            .select('rating comment status');
          break;
      }
    } catch (error) {
      console.error(`Failed to populate reported content:`, error);
    }

    res.json({
      report: {
        id: report._id,
        reporterId: report.reporterId,
        reportedType: report.reportedType,
        reportedId: report.reportedId,
        reportedContent,
        reason: report.reason,
        description: report.description,
        status: report.status,
        adminNotes: report.adminNotes,
        resolvedBy: report.resolvedBy,
        resolvedAt: report.resolvedAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid report ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to get report' });
  }
};

// Resolve a report (admin only)
export const resolveReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const { adminNotes } = req.body;

    const report = await Report.findById(id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    if (report.status !== 'pending') {
      res.status(400).json({ error: 'Report is already resolved or dismissed' });
      return;
    }

    report.status = 'resolved';
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();
    if (adminNotes) {
      report.adminNotes = adminNotes.trim();
    }

    await report.save();
    await report.populate('reporterId', 'email fullName');
    await report.populate('resolvedBy', 'email fullName');

    res.json({
      message: 'Report resolved successfully',
      report: {
        id: report._id,
        status: report.status,
        adminNotes: report.adminNotes,
        resolvedBy: report.resolvedBy,
        resolvedAt: report.resolvedAt,
        updatedAt: report.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid report ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to resolve report' });
  }
};

// Dismiss a report (admin only)
export const dismissReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const { adminNotes } = req.body;

    const report = await Report.findById(id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    if (report.status !== 'pending') {
      res.status(400).json({ error: 'Report is already resolved or dismissed' });
      return;
    }

    report.status = 'dismissed';
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();
    if (adminNotes) {
      report.adminNotes = adminNotes.trim();
    }

    await report.save();
    await report.populate('reporterId', 'email fullName');
    await report.populate('resolvedBy', 'email fullName');

    res.json({
      message: 'Report dismissed successfully',
      report: {
        id: report._id,
        status: report.status,
        adminNotes: report.adminNotes,
        resolvedBy: report.resolvedBy,
        resolvedAt: report.resolvedAt,
        updatedAt: report.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid report ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to dismiss report' });
  }
};
