
import { Response, Request } from 'express';
import { AuthedRequest } from '../middleware/auth';
import User from '../models/User';
import { getAuditContext } from '../middleware/audit';
import * as Audit from '../services/audit.service';
import { diffObjects } from '../utils/diff';

export async function me(req: AuthedRequest, res: Response) {
  const id = req.user?.id;
  const user = await User.findById(id).lean();
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { email,nombre,apellido,avatarurl,rol } = user;
  res.json({ email,nombre,apellido,avatarurl,rol });
}

export async function updateMe(req: AuthedRequest, res: Response) {
  const id = req.user?.id;
  const ctx = getAuditContext(req as Request);

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const before = user.toObject();

  const { email } = req.body as { email?: string };
  if (email) user.email = email;

  await user.save();
  const after = user.toObject();

  const d = diffObjects(before, after);
  const changedFields = Object.keys(d.changed);

  await Audit.log(ctx, {
    action: 'user.update',
    entity: 'User',
    entityId: String(user._id),
    before,
    after,
    metadata: { changedFields }
  });

  res.json({ id: user._id, email: user.email, changedFields });
}
