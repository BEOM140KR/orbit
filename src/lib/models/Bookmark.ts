import mongoose, { Schema, Document, models } from 'mongoose';

export interface IBookmark extends Document {
  uid: string;
  url: string;
  title: string;
  description: string;
  urlToImage: string;
  publishedAt: string;
  sourceName: string;
  createdAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>({
  uid: { type: String, required: true },
  url: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  urlToImage: { type: String, default: '' },
  publishedAt: { type: String, default: '' },
  sourceName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

// User can't save same url twice
BookmarkSchema.index({ uid: 1, url: 1 }, { unique: true });

export default models.Bookmark || mongoose.model<IBookmark>('Bookmark', BookmarkSchema);
