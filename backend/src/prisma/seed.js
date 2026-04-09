const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Donors
  await prisma.donor.createMany({
    data: [
      {
        name: 'Pizza Hut Vijay Nagar',
        address: 'Vijay Nagar, Indore',
        lat: 22.7533,
        lng: 75.8937,
        contactName: 'Ramesh',
        contactPhone: '9876543210',
        email: 'pizzahut@demo.com',
        password: 'demo123'
      },
      {
        name: 'City Bakery Palasia',
        address: 'Palasia, Indore',
        lat: 22.7196,
        lng: 75.8577,
        contactName: 'Suresh',
        contactPhone: '9876543211',
        email: 'bakery@demo.com',
        password: 'demo123'
      },
      {
        name: 'Hotel Sayaji',
        address: 'Khandwa Road, Indore',
        lat: 22.6916,
        lng: 75.8656,
        contactName: 'Mahesh',
        contactPhone: '9876543212',
        email: 'sayaji@demo.com',
        password: 'demo123'
      }
    ],
    skipDuplicates: true
  })

  // Drivers
  await prisma.driver.createMany({
    data: [
      {
        name: 'Amit Sharma',
        email: 'amit@demo.com',
        password: 'demo123',
        phone: '9876543220',
        vehicleType: 'CAR',
        capacityKg: 50,
        currentLat: 22.7400,
        currentLng: 75.8800,
        isAvailable: true,
        trustScore: 92
      },
      {
        name: 'Priya Verma',
        email: 'priya@demo.com',
        password: 'demo123',
        phone: '9876543221',
        vehicleType: 'BIKE',
        capacityKg: 10,
        currentLat: 22.7200,
        currentLng: 75.8600,
        isAvailable: true,
        trustScore: 87
      },
      {
        name: 'Rahul Singh',
        email: 'rahul@demo.com',
        password: 'demo123',
        phone: '9876543222',
        vehicleType: 'VAN',
        capacityKg: 100,
        currentLat: 22.7600,
        currentLng: 75.9000,
        isAvailable: true,
        trustScore: 78
      }
    ],
    skipDuplicates: true
  })

  // Shelters
  await prisma.shelter.createMany({
    data: [
      {
        name: 'City Care Shelter',
        address: 'Rajwada, Indore',
        lat: 22.7196,
        lng: 75.8577,
        contactName: 'Anita',
        contactPhone: '9876543230',
        email: 'shelter1@demo.com',
        password: 'demo123',
        maxCapacityKg: 100,
        acceptingFrom: '18:00',
        acceptingTill: '22:00',
        needsVeg: true,
        needsNonVeg: true
      },
      {
        name: 'Hope Foundation',
        address: 'Geeta Bhawan, Indore',
        lat: 22.7350,
        lng: 75.8700,
        contactName: 'Rakesh',
        contactPhone: '9876543231',
        email: 'shelter2@demo.com',
        password: 'demo123',
        maxCapacityKg: 80,
        acceptingFrom: '17:00',
        acceptingTill: '21:00',
        needsVeg: true,
        needsNonVeg: false
      }
    ],
    skipDuplicates: true
  })

  console.log('✅ Seeding complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())