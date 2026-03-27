import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDb } from '../db.js';
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
import {
  seedUsers,
  seedProducts,
  seedOrders,
  seedActivityLogs,
  seedPurchaseOrders,
  seedQuotations,
  seedRawMaterials,
  seedBoms,
  seedProductionOrders,
  buildSeedCustomers,
  computeBomCosts,
} from './seedData.js';

const force = process.argv.includes('--force');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/inveto';
  await connectDb(uri);
  console.log('Connected to MongoDB');

  if (force) {
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      ActivityLog.deleteMany({}),
      PurchaseOrder.deleteMany({}),
      Customer.deleteMany({}),
      ReturnRequest.deleteMany({}),
      Quotation.deleteMany({}),
      QCChecklist.deleteMany({}),
      ProductVariantGroup.deleteMany({}),
      AppSettings.deleteMany({}),
      RawMaterial.deleteMany({}),
      BillOfMaterials.deleteMany({}),
      ProductionOrder.deleteMany({}),
    ]);
    console.log('Cleared all collections (--force)');
  } else {
    const n = await Product.countDocuments();
    if (n > 0) {
      console.log('Database already has data. Use npm run seed -- --force to reset.');
      process.exit(0);
    }
  }

  const insertedUsers = await User.insertMany(
    seedUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      passwordHash: bcrypt.hashSync(u.password, 10),
    }))
  );
  console.log(`Seeded ${insertedUsers.length} users`);

  await Product.insertMany(seedProducts);
  console.log(`Seeded ${seedProducts.length} products`);

  await Order.insertMany(seedOrders);
  console.log(`Seeded ${seedOrders.length} orders`);

  await ActivityLog.insertMany(seedActivityLogs);
  await PurchaseOrder.insertMany(seedPurchaseOrders);
  await Customer.insertMany(buildSeedCustomers());
  await Quotation.insertMany(seedQuotations);
  await RawMaterial.insertMany(seedRawMaterials);

  const boms = computeBomCosts(seedBoms.map((b) => ({ ...b, materials: b.materials.map((m) => ({ ...m })) })));
  await BillOfMaterials.insertMany(boms);
  await ProductionOrder.insertMany(seedProductionOrders);

  await AppSettings.create({ key: 'main', scheduledReport: null });

  console.log('Seed completed.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
