import { prisma } from '../config/db.js';

async function cleanDuplicates() {
  const allProcs = await prisma.dentistProcedure.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const seen = new Map<string, string>();
  const toDelete: string[] = [];

  for (const p of allProcs) {
    const key = `${p.dentistId}_${p.globalProcedureId}`;
    if (seen.has(key)) {
      toDelete.push(p.id);
    } else {
      seen.set(key, p.id);
    }
  }

  if (toDelete.length > 0) {
    await prisma.dentistProcedure.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`✅ Deleted ${toDelete.length} duplicate(s)`);
  } else {
    console.log('✅ No duplicates found');
  }

  await prisma.$disconnect();
}

cleanDuplicates().catch(console.error);
