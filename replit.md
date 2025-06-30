# TransRoute - Transportation Management System

## Overview

TransRoute is a comprehensive transportation management system built with Node.js, Express, React, and PostgreSQL. The system provides multi-company isolation, role-based access control, and complete transportation operations management including route planning, trip scheduling, reservation management, and financial tracking.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Library**: Radix UI components with Tailwind CSS styling
- **Build Tool**: Vite for fast development and optimized builds
- **Component Library**: shadcn/ui for consistent design system

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with session-based authentication
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Real-time Features**: WebSocket support for live updates

### Database Design
- **Primary Database**: PostgreSQL with connection pooling
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Multi-tenancy**: Company-based data isolation using `companyId` fields
- **Data Integrity**: Foreign key constraints and referential integrity

## Key Components

### Authentication & Authorization
- **Multi-role System**: Support for 9 distinct user roles (super admin, admin, owner, driver, ticket office, etc.)
- **Company Isolation**: Each user belongs to specific companies with isolated data access
- **Session Management**: Secure session handling with PostgreSQL storage
- **Password Security**: bcrypt hashing for password storage

### Transportation Management
- **Route Management**: Create and manage transportation routes with multiple stops
- **Trip Scheduling**: Publish trips with capacity management and pricing
- **Reservation System**: Handle passenger bookings with payment tracking
- **Package Management**: Support for cargo/package transportation alongside passengers

### Financial Management
- **Commission System**: Automated commission calculation for sales agents
- **Cash Box Management**: Track daily cash transactions and reconciliation
- **Budget Tracking**: Trip-level budget and expense management
- **Payment Processing**: Multiple payment methods and advance payment support

### Real-time Operations
- **Live Updates**: WebSocket integration for real-time status updates
- **Boarding Management**: Digital boarding lists and passenger check-in
- **QR Code Integration**: Generate and scan QR codes for tickets
- **Notification System**: In-app notifications for important events

## Data Flow

### Request Flow
1. Client requests authenticate through session middleware
2. Role-based permissions validate access to resources
3. Company isolation filters ensure data segregation
4. Database queries execute with proper security context
5. Response formatting includes only authorized data

### Data Isolation
- All major entities (trips, reservations, routes, vehicles) include `companyId`
- Query filters automatically apply company-based restrictions
- Cross-company access requires explicit super admin privileges
- User-company relationships managed through junction table

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL (version 16+)
- **Node.js**: Version 20+ for optimal performance
- **Package Manager**: npm for dependency management

### Key Libraries
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **drizzle-orm**: Type-safe ORM with PostgreSQL dialect
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: Accessible UI component primitives
- **bcryptjs**: Password hashing and validation
- **passport**: Authentication middleware
- **express-session**: Session management
- **qrcode**: QR code generation for tickets

### Development Tools
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production
- **tailwindcss**: Utility-first CSS framework
- **vite**: Frontend build tool and dev server

## Deployment Strategy

### Environment Configuration
- **Development**: Uses tsx for hot reloading and development server
- **Production**: Compiled with esbuild for optimized Node.js execution
- **Database**: Requires PostgreSQL with connection pooling
- **Session Storage**: Database-backed sessions for scalability

### Build Process
1. Frontend assets compiled with Vite to `dist/public`
2. Backend compiled with esbuild to `dist/index.js`
3. Database migrations applied with Drizzle Kit
4. Static assets served from Express in production

### Security Considerations
- Environment variables for sensitive configuration
- Session secrets for secure authentication
- Database connection encryption supported
- CORS configuration for API security
- Input validation with Zod schemas

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **June 29, 2025** - Updated role-based access control for drivers:
  - Removed "reservations" permission from DRIVER/chofer role to restrict general reservation access
  - Added "reservations-list" permission for drivers to access only their assigned trip reservations
  - Drivers now have access to: dashboard, notifications, packages, reservations-list, cash-register, cash-box, cutoff-history
  - Enhanced security separation between general reservation management and driver-specific reservation viewing

- **June 29, 2025** - Enhanced trip logbook sidebar functionality:
  - Fixed modal z-index issues using React Portal rendering outside sidebar container
  - Implemented custom confirmation modals for budget and expense operations
  - Added expense categories dropdown with native HTML select: Gasolina, Casetas, Otros
  - Resolved sidebar visibility conflicts with proper portal-based modal rendering

- **June 29, 2025** - Enhanced reservation list UI with modern design:
  - Redesigned trip preview cards with gradient headers and color-coded information sections
  - Improved visual hierarchy with rounded sections for schedule, vehicle, and operator info
  - Added hover effects and smooth transitions for better user interaction
  - Implemented cleaner layout separating route information from operational details

- **June 29, 2025** - Enhanced reservation details sidebar with package integration:
  - Added `usePackagesByTrip` hook for intelligent package-to-trip association
  - Implemented multi-criteria matching: recordId, tripId base, and date+route combination
  - Extended `ReservationDetailsSidebar` to display packages alongside reservations
  - Added visual distinction with orange-themed package cards and delivery status indicators

- **June 29, 2025** - Fixed timezone issues in packages section:
  - Corrected date formatting in `PackageTripSelection` component to use local date components
  - Modified `formatDate` function to handle YYYY-MM-DD format without timezone conversion
  - Optimized `formatDateForInput` function to avoid unnecessary date conversions
  - Resolved issue where package trip dates showed one day behind the selected date

## Changelog

- June 13, 2025. Initial setup