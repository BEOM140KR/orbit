import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: 'Firebase User UID mapping',
  },
  email: {
    type: String,
    description: 'User email (optional)',
  },
  keywords: {
    type: [String],
    default: [],
    description: 'List of keywords for personal news filtering',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
