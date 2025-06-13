# TransRoute - Transportation Management System

## Overview
TransRoute is a comprehensive transportation management system built with React and Node.js, designed to handle bus route management, trip scheduling, reservations, and financial operations for transportation companies. The system supports multi-company isolation with role-based access control, allowing different companies to operate independently within the same platform.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side navigation
- **UI Components**: Radix UI primitives with custom styling
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: Express sessions with PostgreSQL store
- **Authentication**: Passport.js with local strategy and bcrypt password hashing
- **API Design**: RESTful endpoints with role-based access control

### Database Schema
The system uses PostgreSQL with the following key entities:
- **Users**: Multi-role system (superAdmin, admin, checker, driver, ticketOffice, owner, developer, commissioner, callCenter)
- **Companies**: Multi-tenant company isolation
- **Routes**: Transportation routes with stops and segments
- **Trips**: Scheduled trips with capacity management
- **Reservations**: Passenger bookings with payment tracking
- **Vehicles**: Fleet management
- **Packages**: Cargo/package shipping functionality

## Key Components

### Multi-Company System
- Company isolation ensures data security between different transportation companies
- Company-specific user access with role-based permissions
- Shared infrastructure with isolated data flows

### Trip Management
- Route creation with multiple stops
- Trip scheduling with capacity management
- Real-time seat availability tracking
- Sub-trip functionality for route segments

### Reservation System
- Passenger booking with multiple passengers per reservation
- Payment tracking (advance payments and remaining balances)
- QR code generation for tickets
- Commission tracking for sales agents

### Financial Management
- Cash register functionality for ticket sales
- Daily cutoff reports
- Commission calculations for sales agents
- Trip budgets and expense tracking

### Role-Based Access Control
Different user roles with specific permissions:
- **Owner**: Full system access
- **Admin**: Administrative functions
- **Call Center**: Reservation management
- **Ticket Office**: Ticket sales
- **Driver**: Trip and passenger management
- **Checker**: Ticket validation
- **Commissioner**: Commission-based sales

## Data Flow

### Authentication Flow
1. User login with email/password
2. Passport.js validates credentials
3. Session established with company context
4. Role-based route protection applied

### Reservation Flow
1. Trip selection from available schedules
2. Passenger information collection
3. Payment processing (advance/full)
4. Ticket generation with QR codes
5. Commission calculation for sales agents

### Trip Management Flow
1. Route creation by authorized users
2. Trip scheduling with vehicle assignment
3. Real-time capacity updates
4. Driver assignment and notifications

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Database connectivity
- **drizzle-orm**: Type-safe database operations
- **passport**: Authentication middleware
- **bcryptjs**: Password hashing
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

### Frontend Dependencies
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: UI component primitives
- **react-hook-form**: Form handling
- **@hookform/resolvers**: Form validation
- **zod**: Schema validation
- **date-fns**: Date manipulation
- **qrcode**: QR code generation

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type checking
- **tailwindcss**: Utility-first CSS framework
- **drizzle-kit**: Database migrations

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20
- **Database**: PostgreSQL 16
- **Development Server**: Vite with HMR
- **Port Configuration**: 5000 (backend), automatic frontend proxy

### Production Deployment
- **Build Process**: Vite frontend build + esbuild backend bundle
- **Environment**: Production Node.js with optimized builds
- **Database**: PostgreSQL with connection pooling
- **Session Storage**: PostgreSQL-backed sessions for scalability

### Replit Configuration
- **Modules**: nodejs-20, web, postgresql-16
- **Auto-deployment**: Configured for Replit's autoscale deployment
- **Development**: Hot reload with automatic restart on changes

### Environment Variables
```
DATABASE_URL=postgresql://...
NODE_ENV=production|development
SESSION_SECRET=secure-random-string
PORT=5000
```

## Changelog
- June 13, 2025. Initial setup

## User Preferences
Preferred communication style: Simple, everyday language.