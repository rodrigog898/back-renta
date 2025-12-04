
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  avatarurl?: string;
  nombre?: string;
  apellido?: string;
  rol?: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  nombre: { type: String, required: false },
  apellido: { type: String, required: false },
  avatarurl: { type: String, required: false },
  rol: { type: String, required: false },
}, { timestamps: true });

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
export default User;
