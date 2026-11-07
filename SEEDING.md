# Database Seeding Guide

## Overview

The Folk platform requires database seeding to create demo/test users and data. The production deployment at https://folk.care requires manual seeding after deployment.

## Important Note

**Seeding is never part of a deploy, and production and preview are protected.** Both hold real data (purged of the original demo dataset on 2026-11-06). Deploy workflows run migrations only.

Every seed path (`db:seed:base`, `db:seed:demo`, and `POST /organizations/:id/seed-demo`) calls the guard in `packages/core/src/service/seed-guard.ts` and refuses unless:

- the database is local (`localhost`/`127.0.0.1`) and `NODE_ENV` is `development` or `test`, or
- `ALLOW_DEMO_SEED=1` is set **by hand** for a disposable, non-protected database.

It always refuses when `ENVIRONMENT`/`NODE_ENV` is `production`, `preview` or `staging`, or when the host is in `PROTECTED_DB_HOSTS`. `ALLOW_DEMO_SEED` cannot override either. To seed a new dataset into a real-data environment, make a reviewed code change to the guard; do not add a seed step to a workflow.

## Quick Start - Seed a Local Database

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/folkcare"
export NODE_ENV=development
npm run db:migrate && npm run db:seed:base && npm run db:seed:demo
```

> The sections below predate this guard and describe the retired dataset. Commands that target a production or preview URL will now refuse.

## Available Seed Scripts

| Script | Description | Users Created |
|--------|-------------|---------------|
| `npm run db:seed` | Basic seed with organization | Minimal |
| `npm run db:seed:demo` | Complete demo data | Texas & Florida focused |
| `npm run db:seed-comprehensive` | **Comprehensive** - All 50 states + DC | 255 users (5 roles × 51 states) |
| `npm run db:seed-all-states` | All states users only | 255 users |

## Comprehensive Seed Data

The comprehensive seed (`seed-comprehensive-demo.ts`) creates:

- **255 Users** (5 roles × 51 states)
- **255 Clients** (5 per state)
- **153 Caregivers** (3 per state)
- **510 Visits** (10 per state)
- **255 Care Plans** (1 per client)
- **1,275 Tasks** (5 per care plan)
- **510 Medications** (2 per client)
- **765 Clinical Notes** (3 per client)
- **26 Incidents** (1 per 10 clients)
- **51 Quality Audits** (1 per state)

**Total: ~4,000+ realistic demo records**

## Login Credentials

### Pattern

All user credentials follow this pattern:

- **Email:** `{role}@{state-code}.folkcare.example`
- **Password:** `Demo{STATE_CODE}{ROLE}123!`

Where:
- `{role}` = admin, coordinator, caregiver, nurse, or family
- `{state-code}` = Two-letter state code (lowercase in email, uppercase in password)
- `{STATE_CODE}` = Two-letter state code in UPPERCASE
- `{ROLE}` = Role name in UPPERCASE

### Examples by State

#### Alabama (AL)
- **Admin:** `admin@al.folkcare.example` / `DemoALADMIN123!`
- **Coordinator:** `coordinator@al.folkcare.example` / `DemoALCOORDINATOR123!`
- **Caregiver:** `caregiver@al.folkcare.example` / `DemoALCAREGIVER123!`
- **Nurse:** `nurse@al.folkcare.example` / `DemoALNURSE123!`
- **Family:** `family@al.folkcare.example` / `DemoALFAMILY123!`

#### California (CA)
- **Admin:** `admin@ca.folkcare.example` / `DemoCAADMIN123!`
- **Coordinator:** `coordinator@ca.folkcare.example` / `DemoCACOORDINATOR123!`
- **Caregiver:** `caregiver@ca.folkcare.example` / `DemoCACAREGIVER123!`
- **Nurse:** `nurse@ca.folkcare.example` / `DemoCANURSE123!`
- **Family:** `family@ca.folkcare.example` / `DemoCAFAMILY123!`

#### Texas (TX)
- **Admin:** `admin@tx.folkcare.example` / `DemoTXADMIN123!`
- **Coordinator:** `coordinator@tx.folkcare.example` / `DemoTXCOORDINATOR123!`
- **Caregiver:** `caregiver@tx.folkcare.example` / `DemoTXCAREGIVER123!`
- **Nurse:** `nurse@tx.folkcare.example` / `DemoTXNURSE123!`
- **Family:** `family@tx.folkcare.example` / `DemoTXFAMILY123!`

#### Florida (FL)
- **Admin:** `admin@fl.folkcare.example` / `DemoFLADMIN123!`
- **Coordinator:** `coordinator@fl.folkcare.example` / `DemoFLCOORDINATOR123!`
- **Caregiver:** `caregiver@fl.folkcare.example` / `DemoFLCAREGIVER123!`
- **Nurse:** `nurse@fl.folkcare.example` / `DemoFLNURSE123!`
- **Family:** `family@fl.folkcare.example` / `DemoFLFAMILY123!`

#### New York (NY)
- **Admin:** `admin@ny.folkcare.example` / `DemoNYADMIN123!`
- **Coordinator:** `coordinator@ny.folkcare.example` / `DemoNYCOORDINATOR123!`
- **Caregiver:** `caregiver@ny.folkcare.example` / `DemoNYCAREGIVER123!`
- **Nurse:** `nurse@ny.folkcare.example` / `DemoNYNURSE123!`
- **Family:** `family@ny.folkcare.example` / `DemoNYFAMILY123!`

### All States

The comprehensive seed creates users for all 50 US states plus DC:

AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY, DC

## Roles

Each state has 5 user roles:

1. **ADMIN** - Full system access
2. **COORDINATOR** - Care coordination and planning
3. **CAREGIVER** - Direct care provision
4. **NURSE** - Clinical oversight
5. **FAMILY** - Family member access

## Production Deployment Steps

1. **Deploy to Vercel** (migrations run automatically)
2. **Seed the database manually:**
   ```bash
   # Connect to production database
   export DATABASE_URL="your-production-database-url"

   # Run comprehensive seed
   npm run db:seed-comprehensive
   ```
3. **Verify login at:** https://folk.care/login
4. **Test with any state's admin credentials** (e.g., `admin@al.folkcare.example` / `DemoALADMIN123!`)

## Troubleshooting

### Login Fails with "Invalid credentials"

**Cause:** Database has not been seeded.

**Solution:**
```bash
export DATABASE_URL="your-database-url"
npm run db:seed-comprehensive
```

### Users already exist

If you need to re-seed, you have two options:

1. **Reset database (destructive):**
   ```bash
   npm run db:nuke && npm run db:migrate && npm run db:seed-comprehensive
   ```

2. **Clear users only:**
   ```sql
   -- Connect to your database and run:
   DELETE FROM users WHERE email LIKE '%@%.folkcare.example';
   ```

### Wrong credentials pattern

Ensure you're using the correct pattern:
- Email uses **lowercase** state code
- Password uses **UPPERCASE** state code and role

**Correct:** `admin@al.folkcare.example` / `DemoALADMIN123!`
**Wrong:** `admin@AL.folkcare.example` / `Demoaladmin123!`

## Security Note

These credentials are for **demo/development use only**. For production deployments with real users:

1. Create proper user accounts via admin interface
2. Use strong, unique passwords
3. Enable MFA where applicable
4. Disable or remove demo accounts

## Additional Resources

- [Deployment Guide](./DEPLOYMENT.md)
- [Seed Script Documentation](./docs/SEED_SCRIPTS.md)
- [Development Setup](./docs/DEVELOPMENT.md)
