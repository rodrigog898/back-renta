import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  isActive: boolean;
}

const refreshTokenSchema = new Schema<IRefreshToken>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true},
  tokenHash: { type: String, required: true, index: true }, 
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  revokedAt: { type: Date }
});

// 👇 Un refresh token por usuario, evita duplicados SIN usar tokenHash como único
refreshTokenSchema.index({ userId: 1 }, { unique: true });

refreshTokenSchema.virtual('isActive').get(function (this: IRefreshToken) {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
});

const RefreshToken: Model<IRefreshToken> = mongoose.models.RefreshToken
  || mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);

export default RefreshToken;
