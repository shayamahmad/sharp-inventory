import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth.js';
import {
  User,
  Product,
  Order,
  ActivityLog,
  PurchaseOrder,
  Customer,
  ReturnRequest,
  Quotation,
  QCChecklist,
  ProductVariantGroup,
  AppSettings,
  RawMaterial,
  BillOfMaterials,
  ProductionOrder,
} from '../models.js';
import { toClientDoc, toClientList, toClientUser } from '../utils/api.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function stripImmutable(body, keys = ['id', '_id']) {
  const o = { ...body };
  keys.forEach((k) => delete o[k]);
  return o;
}

export function registerPublicRoutes(app) {
  app.get(
    '/api/health',
    asyncHandler(async (req, res) => {
      res.json({ ok: true, service: 'inveto-api' });
    })
  );
}

export function registerAuthRoutes(app) {
  app.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
      }
      const user = await User.findOne({ email: email.trim().toLowerCase() });
      if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const token = signToken(user);
      res.json({ token, user: toClientUser(user) });
    })
  );
}

export function registerProtectedRoutes(router) {
  router.get(
    '/products',
    asyncHandler(async (req, res) => {
      const list = await Product.find().sort({ id: 1 }).lean();
      res.json(toClientList(list));
    })
  );

  router.get(
    '/products/:id',
    asyncHandler(async (req, res) => {
      const doc = await Product.findOne({ id: req.params.id }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.post(
    '/products',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id required' });
      const exists = await Product.findOne({ id: body.id });
      if (exists) return res.status(409).json({ error: 'Product id already exists' });
      const doc = await Product.create(body);
      res.status(201).json(toClientDoc(doc));
    })
  );

  router.patch(
    '/products/:id',
    asyncHandler(async (req, res) => {
      const doc = await Product.findOneAndUpdate({ id: req.params.id }, stripImmutable(req.body || {}), {
        new: true,
      }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.delete(
    '/products/:id',
    asyncHandler(async (req, res) => {
      const r = await Product.deleteOne({ id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    })
  );

  router.get(
    '/orders',
    asyncHandler(async (req, res) => {
      const list = await Order.find().sort({ id: 1 }).lean();
      res.json(toClientList(list));
    })
  );

  router.get(
    '/orders/:id',
    asyncHandler(async (req, res) => {
      const doc = await Order.findOne({ id: req.params.id }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.post(
    '/orders',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id required' });
      if (await Order.findOne({ id: body.id })) return res.status(409).json({ error: 'Order id exists' });
      const doc = await Order.create(body);
      res.status(201).json(toClientDoc(doc));
    })
  );

  router.patch(
    '/orders/:id',
    asyncHandler(async (req, res) => {
      const doc = await Order.findOneAndUpdate({ id: req.params.id }, stripImmutable(req.body || {}), {
        new: true,
      }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.delete(
    '/orders/:id',
    asyncHandler(async (req, res) => {
      const r = await Order.deleteOne({ id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    })
  );

  router.get(
    '/activity-logs',
    asyncHandler(async (req, res) => {
      const list = await ActivityLog.find().sort({ createdAt: -1 }).lean();
      res.json(toClientList(list));
    })
  );

  router.post(
    '/activity-logs',
    asyncHandler(async (req, res) => {
      const body = { ...req.body };
      if (!body.id) body.id = `A${Date.now()}`;
      const doc = await ActivityLog.create(body);
      res.status(201).json(toClientDoc(doc));
    })
  );

  router.delete(
    '/activity-logs/:id',
    asyncHandler(async (req, res) => {
      const r = await ActivityLog.deleteOne({ id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    })
  );

  router.get(
    '/purchase-orders',
    asyncHandler(async (req, res) => {
      const list = await PurchaseOrder.find().sort({ id: 1 }).lean();
      res.json(toClientList(list));
    })
  );

  router.post(
    '/purchase-orders',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id required' });
      if (await PurchaseOrder.findOne({ id: body.id })) return res.status(409).json({ error: 'Id exists' });
      const doc = await PurchaseOrder.create(body);
      res.status(201).json(toClientDoc(doc));
    })
  );

  router.patch(
    '/purchase-orders/:id',
    asyncHandler(async (req, res) => {
      const doc = await PurchaseOrder.findOneAndUpdate({ id: req.params.id }, stripImmutable(req.body || {}), {
        new: true,
      }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.delete(
    '/purchase-orders/:id',
    asyncHandler(async (req, res) => {
      const r = await PurchaseOrder.deleteOne({ id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    })
  );

  router.get(
    '/customers',
    asyncHandler(async (req, res) => {
      const list = await Customer.find().sort({ id: 1 }).lean();
      res.json(toClientList(list));
    })
  );

  router.post(
    '/customers',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id required' });
      if (await Customer.findOne({ id: body.id })) return res.status(409).json({ error: 'Id exists' });
      const doc = await Customer.create(body);
      res.status(201).json(toClientDoc(doc));
    })
  );

  router.patch(
    '/customers/:id',
    asyncHandler(async (req, res) => {
      const doc = await Customer.findOneAndUpdate({ id: req.params.id }, stripImmutable(req.body || {}), {
        new: true,
      }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.delete(
    '/customers/:id',
    asyncHandler(async (req, res) => {
      const r = await Customer.deleteOne({ id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    })
  );

  router.get(
    '/returns',
    asyncHandler(async (req, res) => {
      const list = await ReturnRequest.find().sort({ id: 1 }).lean();
      res.json(toClientList(list));
    })
  );

  router.post(
    '/returns',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id required' });
      if (await ReturnRequest.findOne({ id: body.id })) return res.status(409).json({ error: 'Id exists' });
      const doc = await ReturnRequest.create(body);
      res.status(201).json(toClientDoc(doc));
    })
  );

  router.patch(
    '/returns/:id',
    asyncHandler(async (req, res) => {
      const doc = await ReturnRequest.findOneAndUpdate({ id: req.params.id }, stripImmutable(req.body || {}), {
        new: true,
      }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.delete(
    '/returns/:id',
    asyncHandler(async (req, res) => {
      const r = await ReturnRequest.deleteOne({ id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    })
  );

  router.get(
    '/quotations',
    asyncHandler(async (req, res) => {
      const list = await Quotation.find().sort({ id: 1 }).lean();
      res.json(toClientList(list));
    })
  );

  router.post(
    '/quotations',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id required' });
      if (await Quotation.findOne({ id: body.id })) return res.status(409).json({ error: 'Id exists' });
      const doc = await Quotation.create(body);
      res.status(201).json(toClientDoc(doc));
    })
  );

  router.patch(
    '/quotations/:id',
    asyncHandler(async (req, res) => {
      const doc = await Quotation.findOneAndUpdate({ id: req.params.id }, stripImmutable(req.body || {}), {
        new: true,
      }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.delete(
    '/quotations/:id',
    asyncHandler(async (req, res) => {
      const r = await Quotation.deleteOne({ id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    })
  );

  router.get(
    '/qc-checklists',
    asyncHandler(async (req, res) => {
      const list = await QCChecklist.find().lean();
      res.json(
        toClientList(list).map((row) => ({
          productionOrderId: row.productionOrderId,
          items: row.items,
          completedBy: row.completedBy,
          completedAt: row.completedAt,
        }))
      );
    })
  );

  router.put(
    '/qc-checklists/:productionOrderId',
    asyncHandler(async (req, res) => {
      const { items, completedBy, completedAt } = req.body || {};
      const doc = await QCChecklist.findOneAndUpdate(
        { productionOrderId: req.params.productionOrderId },
        { items, completedBy, completedAt },
        { new: true, upsert: true }
      ).lean();
      res.json(toClientDoc(doc));
    })
  );

  router.delete(
    '/qc-checklists/:productionOrderId',
    asyncHandler(async (req, res) => {
      await QCChecklist.deleteOne({ productionOrderId: req.params.productionOrderId });
      res.status(204).end();
    })
  );

  router.get(
    '/product-variants',
    asyncHandler(async (req, res) => {
      const groups = await ProductVariantGroup.find().lean();
      const out = {};
      groups.forEach((g) => {
        out[g.productId] = g.variants || [];
      });
      res.json(out);
    })
  );

  router.put(
    '/product-variants/:productId',
    asyncHandler(async (req, res) => {
      const { variants } = req.body || {};
      const doc = await ProductVariantGroup.findOneAndUpdate(
        { productId: req.params.productId },
        { productId: req.params.productId, variants: variants || [] },
        { new: true, upsert: true }
      ).lean();
      res.json(toClientDoc(doc));
    })
  );

  router.get(
    '/scheduled-report',
    asyncHandler(async (req, res) => {
      const doc = await AppSettings.findOne({ key: 'main' }).lean();
      res.json(doc?.scheduledReport ?? null);
    })
  );

  router.put(
    '/scheduled-report',
    asyncHandler(async (req, res) => {
      const doc = await AppSettings.findOneAndUpdate(
        { key: 'main' },
        { key: 'main', scheduledReport: req.body },
        { new: true, upsert: true }
      ).lean();
      res.json(doc.scheduledReport ?? null);
    })
  );

  router.get(
    '/users',
    asyncHandler(async (req, res) => {
      const list = await User.find().sort({ id: 1 }).lean();
      res.json(list.map(toClientUser));
    })
  );

  router.get(
    '/users/:id',
    asyncHandler(async (req, res) => {
      const doc = await User.findOne({ id: req.params.id }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientUser(doc));
    })
  );

  router.post(
    '/users',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.id || !body.email || !body.password) {
        return res.status(400).json({ error: 'id, email, and password required' });
      }
      if (await User.findOne({ $or: [{ id: body.id }, { email: body.email }] })) {
        return res.status(409).json({ error: 'User id or email exists' });
      }
      const { password, ...rest } = body;
      const doc = await User.create({
        ...rest,
        email: rest.email.trim().toLowerCase(),
        passwordHash: bcrypt.hashSync(password, 10),
      });
      res.status(201).json(toClientUser(doc));
    })
  );

  router.patch(
    '/users/:id',
    asyncHandler(async (req, res) => {
      const body = stripImmutable(req.body || {});
      if (body.password) {
        body.passwordHash = bcrypt.hashSync(body.password, 10);
        delete body.password;
      }
      if (body.email) body.email = body.email.trim().toLowerCase();
      const doc = await User.findOneAndUpdate({ id: req.params.id }, body, { new: true }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientUser(doc));
    })
  );

  router.delete(
    '/users/:id',
    asyncHandler(async (req, res) => {
      const r = await User.deleteOne({ id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    })
  );

  router.get(
    '/raw-materials',
    asyncHandler(async (req, res) => {
      const list = await RawMaterial.find().sort({ materialId: 1 }).lean();
      res.json(toClientList(list).map((row) => ({ ...row, id: row.materialId })));
    })
  );

  router.patch(
    '/raw-materials/:materialId',
    asyncHandler(async (req, res) => {
      const doc = await RawMaterial.findOneAndUpdate(
        { materialId: req.params.materialId },
        stripImmutable(req.body || {}, ['id', 'materialId']),
        { new: true }
      ).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json({ ...toClientDoc(doc), id: doc.materialId });
    })
  );

  router.get(
    '/bill-of-materials',
    asyncHandler(async (req, res) => {
      const list = await BillOfMaterials.find().sort({ productId: 1 }).lean();
      res.json(toClientList(list));
    })
  );

  router.get(
    '/bill-of-materials/:productId',
    asyncHandler(async (req, res) => {
      const doc = await BillOfMaterials.findOne({ productId: req.params.productId }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.get(
    '/production-orders',
    asyncHandler(async (req, res) => {
      const list = await ProductionOrder.find().sort({ id: 1 }).lean();
      res.json(toClientList(list));
    })
  );

  router.get(
    '/production-orders/:id',
    asyncHandler(async (req, res) => {
      const doc = await ProductionOrder.findOne({ id: req.params.id }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.post(
    '/production-orders',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id required' });
      if (await ProductionOrder.findOne({ id: body.id })) return res.status(409).json({ error: 'Id exists' });
      const doc = await ProductionOrder.create(body);
      res.status(201).json(toClientDoc(doc));
    })
  );

  router.patch(
    '/production-orders/:id',
    asyncHandler(async (req, res) => {
      const doc = await ProductionOrder.findOneAndUpdate({ id: req.params.id }, stripImmutable(req.body || {}), {
        new: true,
      }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(toClientDoc(doc));
    })
  );

  router.delete(
    '/production-orders/:id',
    asyncHandler(async (req, res) => {
      const r = await ProductionOrder.deleteOne({ id: req.params.id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    })
  );
}
