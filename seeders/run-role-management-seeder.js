/**
 * Role Management Menu Seeder Runner
 * This script runs the role management menu seeder
 */

const roleManagementSeeder = require('./role-management-menu-seeder');

console.log('🚀 Starting Role Management Menu Seeder...\n');

// Run the seeder
roleManagementSeeder.runSeeder()
    .then(() => {
        console.log('\n🎉 Seeder completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Seeder failed:', error);
        process.exit(1);
    });
