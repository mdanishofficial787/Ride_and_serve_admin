import TermsCondition from '../models/TermsCondition.js';
import TermsSetting from '../models/TermsSetting.js';
import TermsAcceptance from '../models/TermsAcceptance.js';

// Get all terms versions
export const getAllTerms = async (req, res) => {
  try {
    const terms = await TermsCondition.find().sort({ createdAt: -1 });
    res.json({ success: true, data: terms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new terms version
export const createTerm = async (req, res) => {
  try {
    const { version, title, content } = req.body;
    const newTerm = new TermsCondition({
      version,
      title,
      content,
    });
    await newTerm.save();
    res.status(201).json({ success: true, data: newTerm });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a terms version
export const updateTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const { version, title, content } = req.body;
    const updatedTerm = await TermsCondition.findByIdAndUpdate(
      id,
      { version, title, content },
      { new: true }
    );
    if (!updatedTerm) {
      return res.status(404).json({ success: false, message: 'Term not found' });
    }
    res.json({ success: true, data: updatedTerm });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Publish a terms version
export const publishTerm = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Set all others to Draft
    await TermsCondition.updateMany({}, { status: 'Draft' });
    
    // Set the selected to Published
    const publishedTerm = await TermsCondition.findByIdAndUpdate(
      id,
      { status: 'Published', publishedAt: new Date() },
      { new: true }
    );
    
    if (!publishedTerm) {
      return res.status(404).json({ success: false, message: 'Term not found' });
    }
    res.json({ success: true, data: publishedTerm });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get current settings
export const getSettings = async (req, res) => {
  try {
    let settings = await TermsSetting.findOne();
    if (!settings) {
      settings = new TermsSetting();
      await settings.save();
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update settings
export const updateSettings = async (req, res) => {
  try {
    const { showDuringSignup, agreementRequired, checkboxLabel } = req.body;
    let settings = await TermsSetting.findOne();
    if (!settings) {
      settings = new TermsSetting({ showDuringSignup, agreementRequired, checkboxLabel });
    } else {
      settings.showDuringSignup = showDuringSignup;
      settings.agreementRequired = agreementRequired;
      settings.checkboxLabel = checkboxLabel;
    }
    await settings.save();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get acceptance logs
export const getLogs = async (req, res) => {
  try {
    const logs = await TermsAcceptance.find().sort({ acceptedAt: -1 });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
