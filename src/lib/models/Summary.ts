import mongoose from 'mongoose';

const SummarySchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: 'URL of the original news article used as a cache key',
  },
  content: {
    type: String,
    required: true,
    description: '3-line AI summary text translated to Korean',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Summary || mongoose.model('Summary', SummarySchema);
