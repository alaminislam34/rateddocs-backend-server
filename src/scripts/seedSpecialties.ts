import { prisma } from '../config/db.js';

const specialties = [
  {
    name: 'General Dentistry',
    slug: 'general-dentistry',
    description: 'Routine dental care, cleanings, fillings, and preventive education.',
  },
  {
    name: 'Orthodontics',
    slug: 'orthodontics',
    description: 'Diagnosis, prevention, and correction of malpositioned teeth and jaws (braces, aligners).',
  },
  {
    name: 'Endodontics',
    slug: 'endodontics',
    description: 'Specialized care for the inside of the tooth, including root canal therapy.',
  },
  {
    name: 'Periodontics',
    slug: 'periodontics',
    description: 'Prevention, diagnosis, and treatment of gum diseases and dental implants.',
  },
  {
    name: 'Prosthodontics',
    slug: 'prosthodontics',
    description: 'Restoring and replacing teeth with artificial devices such as crowns, bridges, and dentures.',
  },
  {
    name: 'Oral and Maxillofacial Surgery',
    slug: 'oral-maxillofacial-surgery',
    description: 'Surgical treatment of diseases, injuries, and defects of the mouth, teeth, jaws, and face.',
  },
  {
    name: 'Pediatric Dentistry',
    slug: 'pediatric-dentistry',
    description: 'Dedicated dental health care for children from infancy through adolescence.',
  },
  {
    name: 'Cosmetic Dentistry',
    slug: 'cosmetic-dentistry',
    description: 'Treatments aimed at improving the appearance of teeth, gums, and bite (whitening, veneers).',
  },
];

async function seed() {
  console.log('Seeding specialties...');
  for (const specialty of specialties) {
    await prisma.specialty.upsert({
      where: { slug: specialty.slug },
      update: {},
      create: {
        name: specialty.name,
        slug: specialty.slug,
        description: specialty.description,
      },
    });
    console.log(`Specialty upserted: ${specialty.name}`);
  }
  console.log('Seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('Error seeding specialties:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
