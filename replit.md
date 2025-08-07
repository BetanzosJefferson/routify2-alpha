# TransRoute - Transportation Management System

## Overview

TransRoute is a comprehensive transportation management system designed to streamline operations for multi-company transportation businesses. It provides robust features for managing routes, scheduling trips, handling reservations, and tracking finances, all within a secure, role-based access control environment. The system aims to optimize transportation logistics, enhance customer experience, and provide clear financial oversight.

## Recent Updates (Aug 2025)

- **FIXED: Critical sub-trip transfer bug**: Corrected recordId assignment when transferring reservations to sub-trips (format "tripId_segmentIndex")
- **Enhanced reservation filtering**: Updated query logic to find reservations transferred to sub-trips correctly
- **Enhanced passenger transfer**: Added operator name display in transfer mode while maintaining privacy in general trip lists  
- **Improved system integrity**: Resolved cache issues and strengthened trip-reservation relationships

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Library**: Radix UI components with Tailwind CSS styling
- **Component Library**: shadcn/ui for consistent design system
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with session-based authentication
- **Session Storage**: PostgreSQL-backed sessions
- **Real-time Features**: WebSocket support for live updates

### Database Design
- **Primary Database**: PostgreSQL with connection pooling
- **Schema Management**: Drizzle Kit for migrations
- **Multi-tenancy**: Company-based data isolation using `companyId` fields
- **Data Integrity**: Foreign key constraints and referential integrity

### Core System Features
- **Authentication & Authorization**: Multi-role system (9 distinct roles) with company isolation and secure session management.
- **Transportation Management**: Comprehensive route creation, trip scheduling with capacity and pricing, reservation handling, and package management.
- **Financial Management**: Automated commission calculation, cash box management, budget tracking, and multiple payment method support.
- **Real-time Operations**: Live updates via WebSockets, digital boarding, QR code integration for tickets, and in-app notifications.
- **UI/UX Decisions**: Focus on a consistent design system using Radix UI and shadcn/ui, with careful attention to responsive layouts and intuitive workflows (e.g., streamlined package trip selection, improved form clarity).
- **Security Considerations**: Environment variables for sensitive config, session secrets, database connection encryption, CORS, and Zod for input validation.
- **Date Management**: Global, timezone-safe date handling system for consistency across frontend and backend.
- **Error Handling**: Comprehensive error boundary system for graceful error management without user interruptions.

## External Dependencies

- **Database**: PostgreSQL (version 16+)
- **Node.js**: Version 20+
- **Package Manager**: npm
- **Serverless Database Driver**: @neondatabase/serverless
- **ORM**: drizzle-orm
- **State Management**: @tanstack/react-query
- **UI Components**: @radix-ui/react-\*
- **Password Hashing**: bcryptjs
- **Authentication**: passport, express-session
- **QR Code Generation**: qrcode
- **CSS Framework**: tailwindcss
- **Frontend Build Tool**: vite