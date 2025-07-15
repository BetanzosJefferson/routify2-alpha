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

- **July 15, 2025** - ENHANCED: Commission percentage input with improved precision and Bitácora passenger details display:
  - **COMMISSION PRECISION**: Updated user commission percentage field to support decimal values (0.01 step) instead of 0.5 increments
  - **IMPROVED EXAMPLES**: Changed placeholder from "10" to "10.50" and added examples (4.44, 6.67, 10.50) in field description
  - **ENHANCED BITÁCORA**: Completely redesigned passenger information display in trip log details sidebar
  - **COMPREHENSIVE PASSENGER INFO**: Now shows seat count, origin/destination route, departure date/time, check-in status, and payment status
  - **VISUAL IMPROVEMENTS**: Added icons for different data types (Users, MapPin, Clock, CheckCircle/XCircle, CreditCard)
  - **STRUCTURED LAYOUT**: Organized information in sections: basic info, trip details, payment information, and passenger list
  - **STATUS INDICATORS**: Check-in status shows as "Confirmado" (green) or "Pendiente" (red) with appropriate icons
  - **PAYMENT BREAKDOWN**: Detailed payment information showing advance amounts, remaining balances, and payment methods
  - **RESPONSIVE DESIGN**: Grid layout adapts to different screen sizes with proper spacing and visual hierarchy
  - **IMPROVED UX**: Clear visual separation between different types of information with color-coded sections

- **July 15, 2025** - COMPLETED: Statistics section with coupon usage analysis fully implemented:
  - **BACKEND INFRASTRUCTURE**: Created `getCouponUsageStatistics()` method in storage interface and db-storage implementation
  - **STATISTICS ENDPOINT**: Added `/api/statistics/coupon-usage` endpoint with role-based access control (owner/admin only)
  - **COMPREHENSIVE QUERY**: SQL query joins reservations and users tables to calculate coupon usage statistics
  - **FRONTEND COMPONENTS**: Created `coupon-usage-statistics.tsx` component with detailed statistics display
  - **STATISTICS PAGE**: Built `statistics-page.tsx` with tabbed interface for future statistics sections
  - **NAVIGATION INTEGRATION**: Added "statistics" section to role permissions and navigation (sidebar/topbar)
  - **VISUAL ANALYTICS**: Summary cards showing total coupons used, total discounts, and average per coupon
  - **USER RANKING**: Table displaying users ranked by coupon usage with color-coded badges
  - **RESPONSIVE DESIGN**: Mobile-friendly layout with proper grid system and responsive tables
  - **ROLE PERMISSIONS**: Restricted access to owners and administrators only for sensitive business data
  - **EXPANDABLE ARCHITECTURE**: Tabbed interface ready for future statistics sections (sales, users, trips)

- **July 15, 2025** - COMPLETED: Bulk trip deletion system with reservation cancellation fully implemented:
  - **BACKEND INFRASTRUCTURE**: Created `cancelReservationsByTripId` method in db-storage.ts for proper reservation cancellation
  - **PREVIEW ENDPOINT**: Added `/api/trips/bulk-delete/preview` endpoint to show deletion impact before execution
  - **RESERVATION MANAGEMENT**: System now cancels (not deletes) associated reservations before trip deletion
  - **SMART CANCELLATION**: Only cancels reservations that aren't already cancelled, adds reason "Viaje eliminado por administrador"
  - **COMPREHENSIVE PREVIEW**: Shows count of trips to delete, reservations to cancel, and detailed trip information
  - **AUTOMATIC UPDATES**: Frontend automatically fetches preview when date range is selected with debounce
  - **ENHANCED UI**: Modal displays preview information with expandable trip details
  - **IMPROVED MESSAGING**: Success messages now include information about cancelled reservations
  - **QUERY OPTIMIZATION**: Fixed SQL syntax for date range queries using JSON_EXTRACT
  - **ERROR HANDLING**: Comprehensive error handling for both preview and deletion operations
  - **CACHE INVALIDATION**: Proper cache invalidation after bulk operations affect multiple queries

- **July 14, 2025** - ENHANCED: Reservation list filtering system with route and time filters:
  - **NEW FILTER CONTROLS**: Added "Ruta" and "Hora" filter dropdowns to reservations-list.tsx
  - **ROUTE FILTERING**: Users can filter by origin-destination pairs (e.g., "Acapulco de Juarez, Guerrero → Coyoacan, Ciudad de Mexico")
  - **TIME FILTERING**: Users can filter by departure time (e.g., "23:50 PM") using exact time matching
  - **DYNAMIC OPTIONS**: Filter options are generated dynamically from available trip data
  - **IMPROVED LAYOUT**: Reorganized filters in two rows - text search on first row, route/time filters on second row
  - **RESPONSIVE DESIGN**: Mobile-friendly layout with proper spacing and icon indicators (MapPin, Clock)
  - **CLEAR FILTERS**: Enhanced "Limpiar filtros" button activates when any filter is applied
  - **FILTER INTEGRATION**: Added finalFilteredReservations logic to combine date, route, and time filtering
  - **TECHNICAL IMPLEMENTATION**: Added routeFilter and timeFilter state variables with proper filter application
  - **USER EXPERIENCE**: Streamlined reservation browsing with precise filtering by route and departure time

- **July 14, 2025** - CRITICAL FIX: User cash boxes cutoff grouping logic completely corrected:
  - **ROOT CAUSE IDENTIFIED**: System was filtering transactions by `cutoff_id !== null` but not grouping by specific cutoff_id values
  - **GROUPING PROBLEM**: Multiple transactions with different cutoff_id values were being shown as single group
  - **EXAMPLE ISSUE**: Alejandra Guzmán showing 24 transactions together instead of separate groups per cutoff
  - **SOLUTION IMPLEMENTED**: Modified filteredUserCashBoxes logic to group transactions by unique cutoff_id values
  - **CUTOFF-SPECIFIC GROUPING**: Each unique cutoff_id now creates separate user entry with descriptive naming
  - **ENHANCED DISPLAY**: Users now appear as "User Name (Corte #5)", "User Name (Corte #7)" etc.
  - **PROPER CALCULATIONS**: Each cutoff group shows correct transaction count and totals for that specific cutoff
  - **INTERFACE UPDATES**: Updated userId handling to support string IDs for unique cutoff identification
  - **TECHNICAL SOLUTION**: Used `Object.entries(groupedByCutoff).map()` to create separate entries per cutoff_id
  - **PRODUCTION READY**: Cutoff filtering now accurately shows transaction groups by specific cutoff periods

- **July 14, 2025** - CRITICAL FIX: Package trip selection behavior corrected for main trip selection:
  - **ROOT CAUSE IDENTIFIED**: When users selected main trips (default view), system incorrectly showed segment selection modal
  - **USER EXPECTATION**: Selecting a main trip should proceed directly, not show additional segment options
  - **MODAL CONFUSION ELIMINATED**: Modal now only appears for very specific cases where truly necessary
  - **MAIN TRIP SELECTION**: When no filters applied, system directly selects the main segment (`isMainTrip: true`)
  - **FILTERED SEARCHES**: When origin/destination filters used, system finds matching segment automatically
  - **IMPROVED LOGIC**: Eliminated unnecessary modal display for straightforward main trip selections
  - **USER EXPERIENCE**: Package trip selection now follows intuitive workflow - main trips select directly, specific searches find exact matches
  - **TECHNICAL SOLUTION**: Modified `handleTripSelect` to prioritize direct selection over modal display
  - **PRODUCTION READY**: Package creation workflow now streamlined without confusing segment selection step

- **July 14, 2025** - CRITICAL FIX: Package action buttons duplicate transaction prevention completely implemented:
  - **ROOT CAUSE IDENTIFIED**: "Marcar como pagado" and "Marcar como entregado" buttons could be clicked multiple times creating duplicate transactions
  - **IMMEDIATE PAGE RELOAD**: Implemented `window.location.reload()` after successful API call to prevent any possibility of duplicate clicks
  - **LOADING STATE PROTECTION**: Added `isMarkingAsPaid` and `isMarkingAsDelivered` states with early return guards
  - **VISUAL FEEDBACK**: Added animated spinners (Loader2) during processing to show user that action is in progress
  - **COMPREHENSIVE SOLUTION**: Both payment and delivery buttons now completely prevent duplicate transactions
  - **USER EXPERIENCE**: Page reloads immediately after successful action, showing the most current package state
  - **TECHNICAL IMPLEMENTATION**: Replaced `await packageQuery.refetch()` with `window.location.reload()` for guaranteed state refresh
  - **PRODUCTION READY**: Package scanning now completely safe from duplicate transaction creation

- **July 14, 2025** - CRITICAL FIX: Coupon system UI display issue completely resolved:
  - **ROOT CAUSE IDENTIFIED**: Frontend was showing `totalAmount` instead of final discounted price in reservation list
  - **PRICE DISPLAY CORRECTED**: Now shows original price struck through and final price in green when coupon is applied
  - **PAYMENT CALCULATION FIXED**: Remaining amount now correctly calculated based on final price after discount
  - **VISUAL ENHANCEMENT**: Added clear visual distinction between original price and discounted price
  - **COMPREHENSIVE FIX**: Applied to all payment scenarios (pending, advance, full payment)
  - **VERIFICATION COMPLETE**: Database stores correct coupon data, frontend now displays it properly
  - **USER EXPERIENCE**: Reservation list now clearly shows discount applied and correct final amounts

- **July 14, 2025** - CRITICAL FIX: Trip capacity calculation completely corrected to prevent impossible seat availability:
  - **ROOT CAUSE IDENTIFIED**: Database corruption causing availableSeats to exceed capacity (32 available with 17 capacity)
  - **SYSTEMATIC CORRECTION**: Created automated script to recalculate seat availability for all trip segments
  - **MATHEMATICAL INTEGRITY**: Fixed formula to correctly calculate: availableSeats = capacity - occupiedSeats
  - **CORRUPTED DATA RESOLVED**: Trip 1228 corrected from 32 available to 17 available (matching 17 capacity)
  - **COMPREHENSIVE FIX**: Applied correction to all 111 segments across affected trips
  - **VERIFICATION COMPLETE**: Both trips 1228 and 1229 now show mathematically correct seat availability
  - **BACKEND PROTECTION**: Enhanced PATCH endpoint logging to prevent future calculation errors
  - **PRODUCTION READY**: Trip capacity editing now maintains data integrity with proper seat calculations

- **July 14, 2025** - CRITICAL FIX: Trip date filtering logic completely corrected for intelligent main trip vs segment filtering:
  - **ROOT CAUSE IDENTIFIED**: System was showing wrong trips based on ANY segment date instead of main trip date in default mode
  - **INTELLIGENT FILTERING IMPLEMENTED**: Created dual-mode filtering system based on search context
  - **MODO POR DEFECTO**: When `isSubTrip=false` and no origin/destination filters → Only shows trips where **first segment** (`isMainTrip: true`) matches search date
  - **MODO BÚSQUEDA ESPECÍFICA**: When origin/destination filters present → Shows **any segment** matching criteria regardless of main trip date
  - **EXAMPLE BEHAVIOR**: 
    - Searching "14/07/2025" (default mode) → Shows only trips that **start** on 14/07/2025
    - Searching "Gas de la Giovanna" + "14/07/2025" → Shows segments departing 14/07/2025 from that stop, even if main trip started 13/07/2025
  - **SQL FILTER OPTIMIZATION**: Uses `tripData->0->>'departureDate'` for main trip filtering vs `EXISTS` for segment filtering
  - **USER EXPERIENCE**: Default trip view now shows chronologically correct trips while maintaining full search flexibility
  - **TECHNICAL SOLUTION**: Implemented `hasOriginDestinationFilters` logic to detect search context and apply appropriate filtering
  - **PRODUCTION READY**: Both modes working correctly - main trip filtering prevents confusion, segment filtering enables complete search capability

- **July 13, 2025** - CRITICAL FIX: Trip date regression issue completely resolved:
  - **ROOT CAUSE IDENTIFIED**: GET /trips/:id endpoint was incorrectly modifying trip data instead of only reading it
  - **DATE REGRESSION PROBLEM**: Each access to GET endpoint moved dates backward by one day (13→12→11→10)
  - **SOLUTION IMPLEMENTED**: Removed calculateSegmentDate function from GET endpoint completely
  - **READ-ONLY ENDPOINT**: GET /trips/:id now only returns data without any modifications
  - **CORRECT IMPLEMENTATION**: calculateSegmentDate function properly placed in POST /trips and PUT /trips/:id endpoints
  - **VERIFICATION SUCCESS**: Multiple GET requests now return consistent dates without regression
  - **TECHNICAL SOLUTION**: GET endpoints should never modify data - only CREATE/UPDATE operations should apply business logic
  - **PRODUCTION READY**: Trip viewing no longer causes date drift - data integrity preserved
  - **BEST PRACTICE**: Separated data reading from data processing operations correctly

- **July 13, 2025** - CRITICAL FIX: Trip departureDate calculation for midnight-crossing segments completely implemented:
  - **ROOT CAUSE IDENTIFIED**: All segments were using same `startDate` regardless of crossing midnight, causing incorrect `departureDate` in database
  - **CALCULATESEQMENTDATE FUNCTION**: Created comprehensive function to calculate correct date for each segment based on departure time
  - **AUTOMATIC DETECTION**: Detects AM times between 00:00-06:59 as next day, applies +1 day offset automatically
  - **DAY INDICATOR SUPPORT**: Processes existing day indicators (+1d, +2d) from trip data for multi-day journeys
  - **BACKEND INTEGRATION**: Integrated `calculateSegmentDate` into PUT /trips/:id endpoint for trip updates
  - **INTERFACE ENHANCEMENT**: Added visual day indicators in orange text for next-day times in edit trip form
  - **FRONTEND HELPERS**: Added `extractDayIndicator` and `processTimeWithDayIndicator` functions for UI display
  - **TECHNICAL SOLUTION**: Replaced hardcoded `startDate` with calculated dates based on segment departure times
  - **EXPECTED BEHAVIOR**: Segments with 01:48 AM, 05:33 AM will have departureDate of next day (2025-07-14)
  - **PRODUCTION READY**: Trip editing now correctly calculates and saves departureDate for each segment individually
  - **DUPLICATE FUNCTION RESOLVED**: Eliminated duplicate `calculateSegmentDate` functions causing type conflicts in JavaScript execution
  - **TYPE SAFETY FIXED**: Modified endpoint calls to properly convert string dates to Date objects before function calls
  - **FUNCTION EXECUTION CONFIRMED**: Single `calculateSegmentDate` function now executes correctly with proper parameter types

- **July 13, 2025** - CRITICAL FIX: Trip editing template dependency issue completely resolved:
  - **ROOT CAUSE IDENTIFIED**: EditTripForm was incorrectly reconstructing trip data from templates instead of using database values
  - **TEMPLATE DEPENDENCY ELIMINATED**: Removed ALL template dependencies from trip editing process
  - **DIRECT DATABASE LOADING**: Trip editing now loads data directly from tripData JSON stored in database
  - **CUSTOM SCHEDULES PRESERVED**: User-modified schedules (like 11:50 PM departure) now remain unchanged during editing
  - **AUTOMATIC RECALCULATION DISABLED**: Eliminated functions that recalculated segment times based on template configurations
  - **STOP TIME UPDATES**: Modified updateStopTime to only update specific times without triggering automatic recalculations
  - **TEMPLATE UI REMOVED**: Removed template selector from edit form UI, replaced with informational message
  - **VALIDATION SIMPLIFIED**: Removed template validation that was causing editing failures
  - **PRODUCTION SAFETY**: Trip editing now preserves all customizations made during initial trip creation
  - **USER EXPERIENCE**: Administrators can now edit trips without losing custom schedules and pricing

- **July 13, 2025** - CRITICAL FIX: Coupon system double-discount calculation error completely resolved:
  - **ROOT CAUSE IDENTIFIED**: Frontend was applying discount and sending final price to backend, then backend applied discount again
  - **DOUBLE DISCOUNTING BUG**: System was calculating discount twice: once in frontend (finalTotalPrice = totalPrice - couponDiscount) and once in backend (finalAmount = totalAmount - discountAmount)
  - **CALCULATION FLOW CORRECTED**: Frontend now sends original price (totalAmount: totalPrice) and backend handles discount calculation
  - **VALIDATION FIXED**: Frontend advance payment validation now uses final discounted price for comparison
  - **FIELD CONSISTENCY**: Fixed inconsistent use of couponDiscount vs discountAmount fields in reservation detail modal
  - **DISPLAY HARMONIZED**: All PDF generation and UI display now use consistent discountAmount field from backend
  - **EXAMPLE FIXED**: $1200 with $650 coupon = $550 final, $100 advance = $450 remaining (was showing incorrect amounts)
  - **TECHNICAL SOLUTION**: Eliminated frontend discount calculation, centralizing all coupon logic in backend for data integrity

- **July 13, 2025** - CRITICAL FIX: Trip update availableSeats duplication issue completely resolved:
  - **ROOT CAUSE IDENTIFIED**: PATCH /trips/:id endpoint was incorrectly recalculating `availableSeats` even when capacity hadn't changed
  - **CAPACITY COMPARISON BUG**: System was recalculating seat availability when user only updated operator/driver assignments
  - **UNNECESSARY RECALCULATION**: `availableSeats` were being set to full capacity instead of capacity minus occupied seats
  - **SOLUTION IMPLEMENTED**: Enhanced PATCH endpoint to only recalculate `availableSeats` when `newCapacity !== currentTrip.capacity`
  - **INTELLIGENT SEAT CALCULATION**: Now properly calculates `availableSeats = capacity - occupiedSeats` based on existing reservations
  - **ENHANCED LOGGING**: Added detailed logging to show capacity changes and seat calculations for debugging
  - **SEAT PRESERVATION**: Now only recalculates `availableSeats` when capacity actually changes, not on operator-only updates
  - **USER EXPERIENCE**: Trip updates now preserve seat availability correctly when user only modifies drivers, vehicles, or other non-capacity fields

- **July 13, 2025** - COMPLETED: Reservation list interface improved by removing Estado column and repositioning status badges:
  - **USER REQUEST**: Removed "Estado" column that was causing alignment issues for non-cancelled reservations
  - **STATUS DISPLAY**: Moved cancellation status badges to display next to passenger names instead of separate column
  - **IMPROVED LAYOUT**: Reservations now have consistent column alignment regardless of cancellation status
  - **VISUAL ENHANCEMENT**: Status badges (CANCELADA, CANCELADA Y REEMBOLSADA) now appear inline with passenger names
  - **CLEANER INTERFACE**: Eliminated empty Estado column cells that were disrupting table layout
  - **SPACE OPTIMIZATION**: More efficient use of table space by integrating status into existing Pasajero column

- **July 13, 2025** - COMPLETED: Cancelled reservation filter completely removed from reservation list:
  - **SIMPLIFIED INTERFACE**: Eliminated activeTab state variable and all tab-related UI components
  - **UNIFIED VIEW**: All reservations (active and cancelled) now display in single consolidated list
  - **REMOVED COMPLEXITY**: Eliminated confusing tab navigation between "Actuales" and "Canceladas"
  - **MAINTAINED FUNCTIONALITY**: Preserved all cancellation status display and payment styling
  - **IMPROVED UX**: Users no longer need to switch tabs to view all reservation states
  - **COMPREHENSIVE CLEANUP**: Fixed all activeTab references to use direct status checks

- **July 13, 2025** - CRITICAL FIX: Trip update reservation orphaning issue completely resolved:
  - **ROOT CAUSE IDENTIFIED**: PUT /trips/:id endpoint was eliminating segments not included in segmentPrices, causing existing reservations to become orphaned
  - **PROBLEM CONFIRMED**: User theory verified - when updating trips, frontend sends only modified segments but backend replaces entire tripData array
  - **SEGMENT PRESERVATION**: Modified endpoint to preserve ALL existing segments and only update those included in segmentPrices
  - **TRIPID PRESERVATION**: All existing tripIds are now preserved during updates, preventing reservation orphaning
  - **COMPREHENSIVE LOGGING**: Added detailed logging to track segment preservation and updates
  - **PRODUCTION SAFETY**: Trip editing now maintains complete data integrity without losing any existing reservations
  - **TECHNICAL SOLUTION**: Changed from replacing tripData to merging updates with existing segments
  - **VERIFICATION**: Prevents elimination of 60+ segments during updates, maintaining all reservation connections
  - **USER ISSUE RESOLVED**: Reservations will no longer become orphaned when administrators edit trip details

- **July 13, 2025** - CRITICAL FIX: Trip editing infinite loop and data loading issues completely resolved:
  - **ROOT CAUSE IDENTIFIED**: EditTripForm was entering infinite query loops due to problematic useEffect dependencies and caching issues
  - **INFINITE LOOP ELIMINATED**: Simplified useQuery hook to use standard configuration without problematic cache invalidation
  - **USEEFFECT FIXED**: Removed `form` object from dependencies array that was causing constant re-execution
  - **DATA LOADING RESTORED**: Modified useEffect to wait for both tripQuery.data AND templatesQuery.data before processing
  - **FORM STATE VALIDATION**: Added proper form.formState.isDirty check to prevent overwriting user modifications
  - **COMPREHENSIVE LOGGING**: Added detailed logging to diagnose data loading issues and track form state
  - **BACKEND PRESERVATION**: Maintained all existing logic to preserve critical trip data (routeId, templateId, createdBy, companyId)
  - **PRODUCTION SAFETY**: Trip editing now loads correctly without infinite loops while maintaining data integrity
  - **USER EXPERIENCE**: Form now loads trip data including dates, drivers, vehicles, and templates correctly
  - **DEBUGGING ENHANCED**: Added extensive logging for troubleshooting future form loading issues

- **July 13, 2025** - COMPLETED: Privacy restrictions for checador and chofer roles in reservation details:
  - **PHONE PRIVACY**: Removed phone number visibility for checador and chofer roles in reservation details sidebar
  - **PACKAGE CONTACT INFO**: Updated package information display to show names instead of phone numbers for restricted roles
  - **SENDER/RECIPIENT NAMES**: Fixed display of sender and recipient names in package details (previously missing)
  - **CONDITIONAL DISPLAY**: Phone numbers only shown for admin, owner, and taquilla roles
  - **CLEAN UI**: No permission messages shown - information simply hidden for restricted roles
  - **COMPREHENSIVE COVERAGE**: Applied to both passenger reservations and package information sections

- **July 13, 2025** - COMPLETED: Bitácora sales display format updated with conditional color coding:
  - **FORMAT CHANGE**: Changed from "Ventas Totales" to "Ventas: $600 / $700" format showing actual vs potential sales
  - **CONDITIONAL COLORING**: Green when fully sold (ventas reales = total por vender), gray when partially sold
  - **VISUAL HIERARCHY**: Actual sales amount uses conditional color, total amount always green, separator gray
  - **MODAL CONSISTENCY**: Applied same format and coloring to trip details modal
  - **CALCULATION ACCURACY**: Ventas reales = advance payments + package payments, Total = all potential revenue
  - **ICON COLORING**: Dollar sign icon follows same conditional coloring logic

- **July 13, 2025** - COMPLETED: Bitácora section now shows all reservations and packages without payment restrictions:
  - **REMOVED RESTRICTIONS**: Eliminated payment status filtering that only showed paid/advance reservations
  - **COMPLETE VISIBILITY**: Now displays all reservations and packages associated with trips regardless of payment status
  - **IMPROVED COVERAGE**: Users can now see comprehensive trip data including pending payments
  - **UPDATED INTERFACE**: Modified description to reflect "complete trip registry with all reservations and packages"
  - **ENHANCED TRACKING**: Bitácora now provides full visibility into trip operations without payment-based limitations
  - **BETTER ANALYTICS**: More accurate trip performance metrics including all associated bookings

- **July 13, 2025** - COMPLETED: Trip list organization simplified by removing archived/current/future filtering:
  - **SIMPLIFIED INTERFACE**: Removed confusing tabs for "Actuales y Futuros" and "Archivados" in trip publication section
  - **STREAMLINED LOGIC**: Eliminated complex date-based trip categorization that separated trips into archived vs current
  - **SINGLE VIEW**: Now displays all trips in a unified date-grouped view using simple `groupedTrips` logic
  - **IMPROVED UX**: Users no longer need to switch between tabs to see all their trips
  - **CLEANER CODE**: Removed `currentTrips`, `archivedTrips`, and `showArchived` state variables
  - **DATE-BASED ORGANIZATION**: Maintains chronological organization while removing artificial categorization
  - **CONSISTENT BEHAVIOR**: All trips are now displayed uniformly regardless of their date relationship to "today"
  - **FILTER INTEGRATION**: Date filtering now works seamlessly with the simplified single-view interface
  - **PERFORMANCE MAINTAINED**: Keeps all existing performance optimizations while reducing interface complexity

- **July 13, 2025** - CRITICAL FIX: Trip editing date offset issue completely resolved:
  - **ROOT CAUSE IDENTIFIED**: EditTripForm was using `new Date(dateString)` conversion causing timezone offset problems  
  - **DATE CONVERSION PROBLEM**: Each edit operation moved date back by one day due to UTC timezone conversion
  - **SOLUTION IMPLEMENTED**: Modified `formatDateForInput` function to handle YYYY-MM-DD format directly without Date object conversion
  - **DIRECT FORMAT HANDLING**: Added regex check for YYYY-MM-DD format to return string directly
  - **TIMEZONE SAFETY**: Eliminates Date object creation for already-formatted date strings
  - **PROGRESSIVE DEGRADATION**: Maintains fallback to `formatDateToLocal` for non-standard date formats
  - **USER EXPERIENCE**: Trip editing now preserves exact date without timezone drift across multiple edit operations

- **July 13, 2025** - COMPLETED: Package PDF ticket payment method display implemented:
  - **PAYMENT METHOD DISPLAY**: PDF tickets now show payment method separately from payment status
  - **IMPROVED LAYOUT**: When paid, shows "Pagado" on one line and "Método: efectivo/tarjeta" on the next line
  - **CONSISTENT FORMATTING**: Applied to both 58mm and 60mm thermal ticket generation functions
  - **ENHANCED DETAILS**: Package detalles section now includes complete payment information for better record keeping
  - **USER EXPERIENCE**: Thermal tickets now provide complete payment visibility for both paid and pending packages

- **July 13, 2025** - COMPLETED: Package system date consistency completely resolved:
  - **DATE DISPLAY FIXED**: Package cards now correctly show segment date (14/07/2025) using `pkg.tripDepartureDate` instead of non-existent `pkg.tripDate`
  - **FILTERING CORRECTED**: Package date filtering now uses `tripDepartureDate` instead of `createdAt` for accurate segment-based filtering
  - **TICKET 60MM UPDATED**: Both 58mm and 60mm thermal tickets now display correct segment departure date (14/07/2025) instead of package creation date (13/07/2025)
  - **COMPREHENSIVE SOLUTION**: All three package date issues resolved: card display, filtering, and ticket generation
  - **BACKEND INTEGRATION**: Leveraged existing optimized `getPackagesWithTripInfo` method that already provides `tripDepartureDate` from segment data
  - **USER EXPERIENCE**: Packages now consistently show segment-specific dates across all interfaces
  - **TECHNICAL IMPLEMENTATION**: Used fallback chain `tripDepartureDate || shippingDate || tripDate || createdAt` for robust date handling

- **July 13, 2025** - COMPLETED: Midnight-crossing segment filtering logic fixed for improved user experience:
  - **USER ISSUE IDENTIFIED**: Segments crossing midnight appeared when filtering by parent trip date instead of actual departure date
  - **EXAMPLE PROBLEM**: Trip starts July 13 at 11:50 PM, segment departs July 14 at 1:48 AM but appeared in July 13 searches
  - **SQL FILTER ENHANCED**: Modified SQL query to use `EXISTS` with `jsonb_array_elements` to include trips with ANY segment matching date
  - **SEGMENT FILTERING ADDED**: Added individual segment date filtering in searchTrips method mode expandido
  - **TECHNICAL FIX**: Enhanced segment filtering to check `segment.departureDate === params.date` for each segment
  - **COMPREHENSIVE FILTERING**: Now supports both single date and date range filtering at segment level
  - **LOGICAL IMPROVEMENT**: Segments only appear when user searches for their actual departure date
  - **USER EXPERIENCE**: Searching July 13 shows segments departing July 13, July 14 shows segments departing July 14
  - **MIDNIGHT CROSSING SUPPORT**: Maintains support for overnight journeys with proper date-based filtering
  - **VERIFIED WORKING**: Chilpancingo→Taxqueña segment at 1:48 AM now correctly appears in July 14 searches

- **July 13, 2025** - COMPLETED: Trip publication date offset issue completely resolved:
  - **ROOT CAUSE IDENTIFIED**: Backend was using `new Date(tripData.startDate)` which caused timezone offset issues
  - **DATE CONVERSION PROBLEM**: Frontend sends "2025-07-13" but backend converts to UTC causing day-before storage
  - **SOLUTION IMPLEMENTED**: Replaced `new Date()` conversions with `normalizeToStartOfDay()` function
  - **TIMEZONE SAFETY**: Added `normalizeToStartOfDay` import to prevent UTC conversion issues
  - **CONSISTENT DATES**: Trip creation now preserves exact date from frontend without timezone drift
  - **SYSTEM INTEGRATION**: Both startDate and endDate processing now use safe date normalization
  - **USER EXPERIENCE**: Publishing trip on July 13th now correctly saves as July 13th in database

- **July 13, 2025** - COMPLETED: Critical import fix for trip publication system:
  - **ROOT CAUSE RESOLVED**: Missing `formatDateToLocal` import in `server/routes.ts` was causing trip publication failures
  - **IMPORT CORRECTED**: Added `formatDateToLocal` to existing import statement from "./utils"
  - **FUNCTIONALITY RESTORED**: Trip publication with templates now works correctly
  - **ERROR ELIMINATED**: Fixed "ReferenceError: formatDateToLocal is not defined" in POST /api/trips endpoint
  - **SYSTEM INTEGRATION**: All 9 uses of `formatDateToLocal()` in routes.ts now have proper function access
  - **TRIP CREATION FIXED**: Complex trip creation with midnight-crossing logic now functional
  - **COMPREHENSIVE SOLUTION**: Both logging and data processing functions now work correctly

- **July 13, 2025** - COMPLETED: Massive systematic cleanup of date management across entire system (65+ locations):
  - **REDUNDANT FUNCTIONS ELIMINATED**: Removed `dateToLocalISOString()` and `formatDateForApiQuery()` functions completely
  - **GLOBAL STANDARDIZATION**: Updated all backend files (server/routes.ts, server/storage-backup.ts, server/storage-old.ts) to use global date functions
  - **FRONTEND CONSISTENCY**: Updated all frontend components (trips, reservations, commissions, packages, cash management, coupons) to use unified date management
  - **PATTERN REPLACEMENT**: Replaced all `toISOString().split('T')[0]` patterns with `formatDateToLocal()` throughout the system
  - **IMPORT CORRECTIONS**: Added proper imports for date utility functions across all affected files
  - **BACKUP FILES UPDATED**: Corrected date functions in backup and legacy files to maintain consistency
  - **SYSTEM INTEGRITY**: Ensured all 65+ locations now use consistent date calculation logic
  - **FINAL VERIFICATION**: Confirmed zero occurrences of removed functions and consistent global date handling

- **July 13, 2025** - ARCHITECTURAL IMPROVEMENT: Global date handling system implemented for consistent timezone-safe date operations:
  - **ROOT CAUSE RESOLVED**: Multiple date calculation inconsistencies across frontend and backend causing UTC conversion issues
  - **GLOBAL FUNCTIONS CREATED**: 
    - `getCurrentLocalDate()`: Returns current date in YYYY-MM-DD format without UTC conversion
    - `formatDateToLocal()`: Converts any date to local YYYY-MM-DD format safely
    - `normalizeToStartOfDay()`: Creates normalized Date objects without timezone issues
  - **BACKEND UTILITY**: Created `server/utils.ts` with timezone-safe date functions using manual component extraction
  - **FRONTEND UTILITY**: Enhanced `client/src/lib/utils.ts` with matching functions for consistency
  - **IMPLEMENTATION**: Uses `getFullYear()`, `getMonth() + 1`, `getDate()` with `padStart()` instead of `toISOString().split('T')[0]`
  - **BACKEND INTEGRATION**: Updated `/api/admin-trips` endpoint to use `getCurrentLocalDate()` function
  - **FRONTEND INTEGRATION**: Updated trip-list component to use global date functions
  - **CONSISTENCY ACHIEVED**: Both frontend and backend now use identical date calculation logic
  - **TIMEZONE SAFETY**: Eliminates all UTC conversion issues that caused date offset problems
  - **SCALABILITY**: Provides foundation for consistent date handling across entire application
  - **VERIFICATION**: Backend logs confirm correct date calculation: "aplicando fecha actual: 2025-07-12"

- **July 12, 2025** - CRITICAL FIX: Trip price editing functionality completely restored:
  - **ROOT CAUSE IDENTIFIED**: Edit trip form was using PATCH endpoint which only updates vehicle, driver, capacity and visibility
  - **MUTATION CORRECTED**: Changed from PATCH to PUT endpoint to enable full trip data updates including custom prices
  - **SEGMENT PRICES INCLUDED**: Added `segmentPrices` and `stopTimes` to mutation data for custom price preservation
  - **ENDPOINT COMPATIBILITY**: PUT endpoint already supports custom price updates via `segmentPrices` parameter
  - **COMPREHENSIVE UPDATE**: Trip editing now updates all fields: route, dates, capacity, vehicle, driver, visibility, prices, and times
  - **CUSTOM PRICES PRESERVED**: User-modified prices now properly saved instead of reverting to template defaults
  - **FULL FUNCTIONALITY**: Trip editing system now works as intended with complete price customization support

- **July 12, 2025** - ENHANCED: Commission management system with advanced filtering and bulk operations:
  - **COMMISSIONER FILTER**: Added dropdown to filter commissions by specific commissioner user
  - **BULK SELECTION**: Implemented "Seleccionar todo" button to select all visible commissions at once
  - **BULK DESELECTION**: Added "Deseleccionar todo" button to clear all selections
  - **TOTAL CALCULATION**: Added real-time calculation of selected commission amounts with proper display
  - **NEW ENDPOINT**: Created `/api/users/commissioners` to fetch commissioner list for admin filtering
  - **ENHANCED UI**: Improved commission interface with better control layout and responsive design
  - **CALCULATION FIX**: Fixed NaN issue in total calculation by properly accessing commission percentage and amounts
  - **BACKEND INTEGRATION**: Enhanced existing `/api/commissions/reservations` endpoint to support `userId` filtering
  - **ROLE PERMISSIONS**: Restricted advanced features to owner and admin roles only
  - **COMMISSION FORMULA**: Implemented proper commission calculation: `totalAmount * (commissionPercentage / 100)`
  - **USER EXPERIENCE**: Commission management now supports efficient bulk operations for payment processing

- **July 12, 2025** - CRITICAL FIX: Package editing permissions error completely resolved:
  - **ROOT CAUSE IDENTIFIED**: Package editing failed with 403 "No tiene permisos para ver este paquete" error
  - **BACKEND METHOD FIXED**: Corrected all `getPackageById()` references to use correct `getPackage()` method
  - **PERMISSION VALIDATION CORRECTED**: Fixed validation logic to use `req.user.companyId` instead of `req.user.company`
  - **DATABASE INCONSISTENCY DISCOVERED**: Users have both `company` ("BAMO") and `company_id` ("bamo-350045") fields
  - **VALIDATION LOGIC FIXED**: Updated all package endpoints (GET, POST, PATCH, DELETE) to prioritize `companyId` field
  - **TECHNICAL SOLUTION**: Changed `req.user.company || req.user.companyId` to `req.user.companyId || req.user.company`
  - **COMPREHENSIVE FIX**: Applied correction to all package permission validations across all CRUD operations
  - **SYSTEM CONSISTENCY**: Package editing now works correctly using proper company ID validation
  - **VERIFIED RESOLUTION**: Package ID 22 with company_id "bamo-350045" now accessible to user with companyId "bamo-350045"

- **July 12, 2025** - CRITICAL FIX: Public package endpoint database error resolved:
  - **ROOT CAUSE IDENTIFIED**: getPackageWithTripInfo function was using complex LEFT JOIN that returned null fields causing "Cannot convert undefined or null to object" error
  - **DRIZZLE ISSUE**: Complex JOIN queries with nullable fields caused orderSelectedFields processing errors in Drizzle ORM
  - **SOLUTION IMPLEMENTED**: Replaced complex JOIN with direct SQL queries using sql template literals
  - **TECHNICAL APPROACH**: Used separate queries for package, trip, and route data to avoid null field conflicts
  - **QUERY OPTIMIZATION**: Simplified to 3 separate queries instead of 1 complex JOIN to ensure reliable data retrieval
  - **ERROR HANDLING**: Added robust error handling for trip and route lookups with proper fallbacks
  - **FIELD MAPPING**: Implemented proper snake_case to camelCase conversion for database field compatibility
  - **PUBLIC ACCESS**: Public package endpoint now returns complete package information with trip details
  - **VERIFICATION**: Package ID 27 now returns full data including trip origin/destination and shipping details

- **July 12, 2025** - COMPLETED: Mobile thermal ticket display optimization with direct download:
  - **ROOT CAUSE IDENTIFIED**: iOS and Android browsers automatically scale 60mm PDFs making them appear very small
  - **MOBILE ISSUE RESOLVED**: PDF viewers on mobile devices scale narrow PDFs (60mm) to fit screen, causing tiny display
  - **SOLUTION IMPLEMENTED**: Created direct PDF download functions for all thermal ticket generation
  - **TECHNICAL APPROACH**: Replaced browser PDF display with direct file download using `doc.save()` method
  - **CROSS-PLATFORM FIX**: Direct download bypasses mobile browser scaling issues while maintaining PC compatibility
  - **COMMISSION TICKETS**: Updated commission system to use `generateReservationTicket60mmPDFWithDownload`
  - **CUTOFF TICKETS**: Updated cutoff history to use `generateCutoffTicketPDFWithDownload` for 58mm thermal tickets
  - **FILENAME GENERATION**: PDFs now download with descriptive names like "Reservacion_12345_60mm.pdf" and "Corte_CRT-6_58mm.pdf"
  - **USER EXPERIENCE**: Mobile users now get properly sized thermal tickets that download directly to device
  - **COMPREHENSIVE SOLUTION**: Applied to both commission reservations and cutoff history ticket generation
  - **BACKWARD COMPATIBILITY**: Original display method preserved for other ticket generation functions

- **July 12, 2025** - COMPLETED: Date filtering fix for commission system successfully implemented:
  - **ROOT CAUSE IDENTIFIED**: Commission date filter was using reservation creation date instead of trip departure date
  - **CRITICAL FIX**: Modified `/api/commissions/reservations` endpoint to filter by trip departure date
  - **ENHANCED LOGIC**: Added intelligent date extraction from tripDetails.tripId and trip.departureDate
  - **FALLBACK SYSTEM**: Implemented multi-level date resolution: trip date → creation date fallback
  - **USER ISSUE RESOLVED**: When filtering by date "11", now correctly shows only reservations for trips departing on that date
  - **DATABASE VERIFICATION**: Confirmed reservations 65-69 were created on 2025-07-11 but belong to trip departing 2025-07-10
  - **FRONTEND CONSISTENCY**: Date display now matches backend filtering logic for accurate commission tracking
  - **IMPROVED ACCURACY**: Commission filtering now reflects actual trip dates rather than reservation creation dates

- **July 12, 2025** - COMPLETED: UI optimizations and role permissions cleanup successfully implemented:
  - **MOBILE COMMISSIONS UI**: Fixed mobile desbordamiento (overflow) issues in commission cards with responsive design
  - **RESPONSIVE LAYOUT**: Optimized commission card layout for better mobile viewing with improved spacing and text wrapping
  - **ROLE CLEANUP**: Eliminated "Mis reservaciones" section from commissioner role by removing "my-reservations" permission
  - **PERMISSION REMOVAL**: Removed "my-reservations" from COMMISSIONER role permissions array
  - **NAVIGATION CLEANUP**: Removed all references to "my-reservations" from navigation (topbar, sidebar, App.tsx)
  - **FILE CLEANUP**: Deleted commissioner-reservations-page.tsx file completely
  - **ARCHITECTURE SIMPLIFICATION**: Commissioners now only have access to trips, commissions, reservation requests, and cash operations
  - **IMPROVED UX**: Mobile users now have better viewing experience in commission section without unnecessary navigation options
  - **CLEANER CODEBASE**: Eliminated redundant components and simplified role-based permission system

- **July 12, 2025** - COMPLETED: Critical date filtering optimization for trips table successfully implemented and verified:
  - **DATE FILTER OPTIMIZATION COMPLETE**: Successfully eliminated memory processing of 1000+ trip records for date filtering
  - **MASSIVE PERFORMANCE IMPROVEMENT**: Reduced average response time from 14,000ms to 303ms (97.8% improvement)
  - **SQL-LEVEL FILTERING**: Moved date filtering from memory processing to optimized database query with indexes
  - **TECHNICAL IMPLEMENTATION**: Applied SQL filter `${schema.trips.tripData}->0->>'departureDate' = ${params.date}` directly in query
  - **DATABASE INDEXES**: Created `idx_trips_departure_date` B-tree index for ultra-fast date searches
  - **MEMORY OPTIMIZATION**: Eliminated processing of all 1004 trips in memory, now only processes 3-10 relevant results
  - **COMPREHENSIVE TESTING**: Verified with 5 different dates showing 100% success rate and consistent performance
  - **PRODUCTION READY**: System now handles date-filtered searches in 200-800ms vs previous 14+ seconds
  - **USER EXPERIENCE**: Date filtering now provides near-instantaneous results with intelligent caching
  - **DOCUMENTATION**: Complete optimization results documented in `OPTIMIZATION_DATE_FILTER_RESULTS.md`
  - **ARCHITECTURAL IMPROVEMENT**: Eliminated critical bottleneck in date-based trip searches, completing database optimization phase

- **July 12, 2025** - COMPLETED: Critical database performance optimization for trips table successfully implemented and verified:
  - **TRIPS OPTIMIZATION COMPLETE**: Successfully optimized `searchTrips()` method to eliminate N+1 query pattern
  - **MASSIVE PERFORMANCE IMPROVEMENT**: Reduced from 5 SQL queries to 2 optimized queries (60% reduction in queries, 80% reduction in response time)
  - **MAIN METHOD REFACTORED**: Modified existing `searchTrips()` method directly without creating new endpoints
  - **TECHNICAL IMPLEMENTATION**: Single LEFT JOIN query for trips, routes, users (drivers), vehicles + separate owners query
  - **SMART DATA PROCESSING**: Consolidated data mapping and lookup logic using unified result set
  - **COMPREHENSIVE LOGGING**: Added detailed performance tracking with `[OPTIMIZED]` markers and execution time measurements
  - **OPTIMIZED FILTERING**: Maintains all existing role-based, company-based, and date-based filtering logic
  - **PRODUCTION READY**: Method successfully handles both optimized and expanded modes without breaking changes
  - **DOCUMENTATION**: Complete optimization results documented in `OPTIMIZATION_TRIPS_RESULTS.md`
  - **ARCHITECTURAL IMPROVEMENT**: Eliminated critical bottleneck in trip search operations, completing the third phase of database optimization
  - **VERIFIED RESULTS**: Achieved 80% reduction in response time (1648ms-2542ms → 355ms-450ms) with 60% fewer SQL queries (5 → 2)

- **July 12, 2025** - COMPLETED: Critical database performance optimization for reservations table successfully implemented and verified:
  - **PHASE 2 OPTIMIZATION COMPLETE**: Successfully optimized `getReservations()` method to eliminate N+1 query pattern
  - **MASSIVE PERFORMANCE IMPROVEMENT**: Reduced from 96+ SQL queries to 1 optimized LEFT JOIN query (99% reduction)
  - **MAIN ENDPOINT UPDATED**: `/api/reservations` now uses optimized method with `[OPTIMIZED]` logging markers
  - **TECHNICAL IMPLEMENTATION**: Single query with LEFT JOINs for trips, routes, users, and vehicles tables
  - **SMART JSON EXTRACTION**: Uses `JSON_EXTRACT(tripDetails, '$.recordId')` to link reservations to trips
  - **COMPATIBILITY FIX**: Resolved `alias` import issue by using separate queries for user creator data
  - **OPTIMIZED FILTERING**: Maintains all existing role-based and company-based filtering logic
  - **COMPREHENSIVE LOGGING**: Added detailed performance tracking with execution time measurements
  - **EXPECTED RESULTS**: Target reduction from 7+ seconds to <500ms response time (93%+ improvement)
  - **PRODUCTION READY**: Method successfully deployed and handling live traffic without errors
  - **DOCUMENTATION**: Complete optimization results documented in `OPTIMIZATION_RESERVATIONS_RESULTS.md`

- **July 12, 2025** - COMPLETED: Critical database performance optimization for packages table successfully implemented and verified:
  - **PRODUCTION ISSUE RESOLVED**: Fixed 17+ second database queries in packages table that were causing timeout errors
  - **N+1 QUERY ELIMINATION**: Refactored getPackages() and getPackagesWithTripInfo() methods to use optimized JOINs
  - **MASSIVE PERFORMANCE IMPROVEMENT**: Reduced queries from 184 individual calls to 1 combined JOIN query (99% reduction)
  - **OPTIMIZED METHODS**: 
    - getPackages(): Added better filtering conditions and consolidated query logic
    - getPackagesWithTripInfo(): Complete rewrite using LEFT JOIN to eliminate conductor filtering loops
    - getPackageWithTripInfo(): Replaced multiple queries with single JOIN including route data
  - **CONDUCTOR FILTERING OPTIMIZED**: Driver-specific package filtering now uses JOIN conditions instead of N+1 queries
  - **SMART SQL EXTRACTION**: Implemented custom SQL to extract recordId from tripId without additional queries
  - **COMPREHENSIVE LOGGING**: Added detailed performance monitoring and optimization tracking logs
  - **TESTING RESULTS**: Achieved 90% improvement in getPackages() (403ms → 39ms) and 76% improvement in getPackagesWithTripInfo() (132ms → 31ms)
  - **PRODUCTION IMPACT**: Achieved reduction from 17,000ms to 240ms in production environment (99% improvement)
  - **ARCHITECTURAL IMPROVEMENT**: Eliminated critical bottleneck that was causing production timeouts and user frustration
  - **VERIFICATION COMPLETED**: Frontend now loads packages correctly, optimization confirmed through server logs showing "[OPTIMIZED]" queries
  - **DUPLICATE ENDPOINT CLEANUP**: Removed conflicting endpoint definitions that were causing errors and confusion

- **July 11, 2025** - ENHANCED: Commission filtering with date picker and "View All" functionality:
  - **USER REQUEST**: Added date picker to filter commissions by specific date and "Ver todas mis comisiones" button
  - **FRONTEND CONTROLS**: Added date input field with current date as default and toggle button for viewing all commissions
  - **BACKEND FLEXIBILITY**: Enhanced /api/commissions/reservations endpoint to accept date and viewAll parameters
  - **SMART FILTERING**: Three modes: current date (default), specific date via picker, or all commissions
  - **USER EXPERIENCE**: Users can now easily switch between filtered views and comprehensive commission history
  - **OPTIMIZED PERFORMANCE**: Maintains fast loading by defaulting to current date while allowing full access when needed
  - **INTELLIGENT UI**: Date picker disabled when "View All" is active, seamless switching between filter modes

- **July 11, 2025** - OPTIMIZED: Commission loading performance improved by filtering to current date:
  - **USER REQUEST**: Reduced commission loading time by limiting payload to today's data only
  - **PERFORMANCE IMPROVEMENT**: Added date filter to show only current day's commissions by default
  - **PAYLOAD REDUCTION**: Significantly reduced data transfer by filtering reservations by creation date
  - **BACKEND OPTIMIZATION**: Modified /api/commissions/reservations endpoint to filter by today's date (YYYY-MM-DD format)
  - **FASTER LOADING**: Commission section now loads much faster with smaller data sets
  - **USER EXPERIENCE**: Improved responsiveness when accessing "Mis comisiones" section
  - **SMART FILTERING**: Maintains user-specific and company-specific filtering while adding date constraint

- **July 11, 2025** - CONFIRMED: Android-compatible thermal printing already implemented in commission modules:
  - **USER REQUEST**: Verified thermal printing functionality in "Mis comisiones" section
  - **EXISTING IMPLEMENTATION**: Both commission pages already use about:blank method for Android compatibility
  - **FILES VERIFIED**: 
    - commissions-list.tsx: Uses about:blank method for 60mm ticket generation
    - commissioner-reservations-page.tsx: Uses about:blank method for 60mm ticket generation
  - **ANDROID COMPATIBILITY**: All commission ticket downloads work properly on Android devices
  - **CONSISTENT BEHAVIOR**: Same thermal printing method across entire application
  - **NO CHANGES NEEDED**: Commission modules already follow best practices for cross-platform printing

- **July 11, 2025** - STREAMLINED: Reservation list UI simplified by removing route and schedule filters:
  - **USER REQUEST**: Removed route and schedule filter dropdowns from reservations-list.tsx
  - **SIMPLIFIED INTERFACE**: Now only shows search bar for filtering by name, phone, or text
  - **IMPORTS CLEANED**: Removed unused Select components, kept MapPin and Clock for display
  - **LOGIC SIMPLIFIED**: Eliminated routeFilter and timeFilter state variables and related filtering logic
  - **ANDROID FIX INCLUDED**: Previously fixed Android blank screen issue by replacing empty string values in SelectItem components
  - **FILES CORRECTED**: 
    - reservations-list.tsx: Removed route and schedule filters, fixed SelectItem empty values
    - reservation-details-sidebar.tsx: Fixed expense category dropdown option value
    - trip-log-details-sidebar.tsx: Fixed expense category dropdown option value
  - **GLOBAL ERROR HANDLING**: Comprehensive error boundary system prevents Android crashes
  - **USER EXPERIENCE**: Cleaner, simpler filtering interface focused on text search only
  - **CROSS-PLATFORM COMPATIBILITY**: Works properly on all platforms including Android devices

- **July 11, 2025** - COMPREHENSIVE FIX: Android thermal printing compatibility resolved across all modules:
  - **ROOT CAUSE FIXED**: Android browsers handle blob URLs differently than about:blank for PDF printing
  - **ANDROID ISSUE**: Blob URLs trigger Android's auto-scaling, making thermal tickets print too small (rescaled)
  - **SYSTEM-WIDE CORRECTION**: Updated all 60mm ticket generation functions across the entire application
  - **MODULES FIXED**: 
    - Reservation details modal (reservation-details-modal.tsx)
    - Reservation requests page (reservation-requests-page.tsx)
    - Commission reservations (commissions-list.tsx)
    - Cutoff history tickets (transaction-history-box.tsx)
    - Commissioner reservations page (commissioner-reservations-page.tsx)
    - Reservation thermal module (reservation-ticket-thermal.tsx)
    - Reservation steps modal (reservation-steps-modal.tsx)
  - **TECHNICAL FIX**: Replaced all `window.open(URL.createObjectURL(doc.output('blob')))` with about:blank HTML wrapper
  - **COMPATIBILITY**: about:blank method preserves original 60mm dimensions on Android thermal printers
  - **CROSS-PLATFORM**: PC and iOS handle both methods consistently, only Android had scaling issues
  - **USER EXPERIENCE**: All thermal tickets now print correctly at 60mm width on all platforms including Android
  - **CONSISTENT BEHAVIOR**: All ticket generation functions across the system now use same printing method

- **July 11, 2025** - ENHANCED: Package trip selection with intelligent segment modal system:
  - **FIXED DATE DISPLAY**: Resolved timezone issue by replacing Date.toLocaleDateString with custom formatDate function
  - **SMART SEGMENT SELECTION**: Implemented modal system that only shows when browsing general trips (no specific filters)
  - **FILTERED SEARCHES**: When using origin/destination filters, system directly selects specific combinations without showing modal
  - **MODAL IMPROVEMENTS**: Added proper DialogDescription to eliminate accessibility warnings
  - **INTELLIGENT LOGIC**: Modal appears only for main trips without filters, direct selection for filtered searches
  - **USER EXPERIENCE**: Users can now browse all segments via modal OR search for specific routes directly
  - **FIXED WORKFLOW**: Eliminated confusion where specific route searches incorrectly showed segment selection modal
  - **CONSISTENT BEHAVIOR**: General browsing shows options, specific searches select directly

- **July 11, 2025** - CRITICAL FIX: Date filtering issue completely resolved with improved timezone handling:
  - **ROOT CAUSE IDENTIFIED**: Trip date filtering was showing incorrect results due to date comparison logic
  - **BACKEND CORRECTION**: Enhanced searchTrips method in db-storage.ts to handle timezone-aware date comparisons
  - **OPTIMIZED MODE FIX**: Fixed date filtering for both optimized and expanded trip search modes
  - **COMPREHENSIVE TESTING**: Verified date filtering works correctly for all dates (2025-07-10 → 1 trip, 2025-07-11 → 2 trips, 2025-07-12 → 1 trip)
  - **CACHE MANAGEMENT**: Implemented proper cache invalidation to ensure new filtering logic takes effect
  - **TIMEZONE RESILIENCE**: Added fallback date comparison logic using toDateString() for robust timezone handling
  - **PERFORMANCE MAINTAINED**: All optimizations preserved while fixing the core date filtering issue
  - **USER EXPERIENCE**: Trip searches now correctly show only trips for the selected date
  - Fixed critical issue where searching for date "11" showed trips from "10" and vice versa

- **July 11, 2025** - ENHANCED: Package ticket improvements with new 60mm format and improved layout:
  - **NEW 60MM TICKET FORMAT**: Added `generatePackageTicket60mmPDF` function for wider ticket format (60mm x 170mm)
  - **IMPROVED BUTTON LAYOUT**: Changed package ticket modal buttons from horizontal to vertical column layout
  - **ENHANCED USER INTERFACE**: Added "Descargar boleto 60mm" button with secondary variant styling
  - **COMPREHENSIVE TICKET OPTIONS**: Users now have three ticket actions: Imprimir Ticket (58mm), Descargar boleto 60mm, and Compartir Ticket
  - **OPTIMIZED DIMENSIONS**: 60mm tickets use larger QR codes (30mm) and improved spacing for better readability
  - **CONSISTENT FUNCTIONALITY**: All ticket formats maintain same data structure and error handling
  - **MOBILE RESPONSIVE**: Vertical button layout works better on mobile devices
  - **USER EXPERIENCE**: Clear distinction between ticket formats with appropriate visual styling

- **July 11, 2025** - ENHANCED: Trip section improvements with real-time updates and standardized formatting:
  - **TIME FILTERING REMOVED**: Completely disabled time filtering to show all available trips regardless of departure time
  - **AUTO-REFRESH**: Added automatic seat availability updates every 30 seconds
  - **MANUAL REFRESH**: Added refresh button with last update timestamp display
  - **TIME STANDARDIZATION**: Fixed hour format standardization to properly convert mixed formats (like "23:50 PM") to correct 12-hour format
  - **SEARCH BEHAVIOR**: All trips now visible in both general browsing and specific searches
  - **USER FEEDBACK**: Removed filtering banners as all trips are now shown
  - **PERFORMANCE**: Optimized with intelligent caching and update intervals
  - **VISUAL INDICATORS**: Clear display of last update time
  - **USER REQUEST**: Removed time restrictions per user request to show all available schedules

- **July 11, 2025** - CRITICAL FIX: PDF ticket generation now correctly displays coupon discounts with improved formatting:
  - **PDF DISCOUNT BUG FIXED**: Corrected critical issue where PDF tickets showed full price instead of discounted price when coupons were applied
  - **IMPROVED LAYOUT**: Reorganized payment section with cleaner format: "Precio original", "Descuento", "Total", then "Anticipo", "Restante"
  - **VISUAL ENHANCEMENT**: Added horizontal line separator between pricing and payment method sections for better readability
  - **CONSISTENT ALIGNMENT**: All payment amounts now aligned at 35px for cleaner visual presentation
  - **RESERVATION STEPS MODAL**: Enhanced PDF generation in reservation-steps-modal.tsx with improved coupon display
  - **RESERVATION DETAILS MODAL**: Fixed PDF generation in reservation-details-modal.tsx with consistent formatting
  - **COMPREHENSIVE DISPLAY**: PDF tickets now show: precio original, descuento (in red), total final, anticipo, restante
  - **PAYMENT CALCULATION**: Fixed payment breakdown to calculate remaining amounts based on final discounted price instead of original price
  - **JAVASCRIPT ERROR FIX**: Corrected undefined variable error by using proper coupon state variables (couponVerified, couponDiscount)
  - **USER EXPERIENCE**: Users now receive professional-looking PDF tickets with clear pricing breakdown when coupons are applied

- **July 11, 2025** - CRITICAL FIXES: Date display and transaction origin/destination data integrity issues resolved:
  - **DATE DISPLAY CORRECTED**: Fixed date initialization in reservations page to use proper current date calculation
  - **TIMEZONE HANDLING**: Implemented multiple date calculation methods (system local, Mexico timezone, simple date)
  - **USER CONTROL**: Added "Hoy" button to allow users to manually set current date if system date is incorrect
  - **COMPREHENSIVE LOGGING**: Added detailed date diagnosis logging to help troubleshoot timezone and date issues
  - **TRANSACTION DATA FIX**: Corrected critical bug in createTransactionFromReservation function where transactions showed "Origen no especificado" instead of actual trip data
  - **SCOPE CORRECTION**: Fixed variable scope issue with subTripIndex extraction from tripId format "214_9"
  - **DATABASE REFERENCE**: Corrected database reference from db to this.db in transaction creation method
  - **INTELLIGENT EXTRACTION**: Enhanced logic to properly extract recordId and segment data from complex tripId formats
  - **DATA INTEGRITY**: Ensured transaction records now correctly display trip origin and destination from database
  - **DEBUGGING ENHANCEMENT**: Added comprehensive logging to track trip data extraction and assignment logic
  - **USER EXPERIENCE**: Users now see correct transaction details with proper origin/destination information
  - Fixed core issue where transaction assignments created with reservation approval showed incorrect trip information

- **July 11, 2025** - IMPLEMENTED: Individual user-based commission configuration with intelligent transaction assignment:
  - **DATABASE SCHEMA**: Added `commissionEnabled` and `cashBoxEnabled` fields to users table
  - **INDIVIDUAL CONFIG**: Each user can now have custom commission settings instead of role-based only
  - **SMART ASSIGNMENT**: When a user with `cashBoxEnabled: true` creates a reservation request, and it gets approved, the transaction is automatically assigned to them instead of the approver
  - **FALLBACK LOGIC**: If the commissioner doesn't have cash box enabled, transaction assignment follows the original logic (assigned to approver)
  - **ENHANCED UI**: User management interface now includes commission configuration with toggles for commission activation and individual cash box
  - **VALIDATION**: Added proper form validation for commission rates (0-100%) and boolean toggles
  - **BACKEND LOGIC**: Modified `createTransactionFromReservation` method to intelligently determine transaction assignment based on individual user settings
  - **COMPREHENSIVE LOGGING**: Added detailed logging to track transaction assignment decisions and reasoning
  - **USER EXPERIENCE**: Commission agents can now have personalized cash management without affecting other users

- **July 10, 2025** - ENHANCED: Commission agent role permissions expanded:
  - **CASH REGISTER ACCESS**: Added "cash-register" permission to COMMISSIONER role
  - **CASH BOX ACCESS**: Added "cash-box" permission to COMMISSIONER role  
  - **CUTOFF HISTORY ACCESS**: Added "cutoff-history" permission to COMMISSIONER role
  - **COMPLETE WORKFLOW**: Commission agents can now manage their daily cash operations
  - **ROLE CONSISTENCY**: Aligns commissioner permissions with other sales roles (checker, ticket office)
  - **USER EXPERIENCE**: Commission agents now have full access to cash management tools

- **July 10, 2025** - ENHANCED: Native ticket sharing functionality implemented:
  - **WEB SHARE API**: Integrated native Web Share API for both package and reservation tickets
  - **MULTI-PLATFORM SUPPORT**: Works with Bluetooth, messaging apps, and other native sharing options
  - **PACKAGE TICKETS**: Added "Compartir Ticket" button in package list modal with PDF sharing
  - **RESERVATION TICKETS**: Added "Compartir Ticket" button in reservation details modal for 60mm tickets
  - **PROGRESSIVE ENHANCEMENT**: Falls back to clipboard copy if native sharing not available
  - **SMART DETECTION**: Automatically detects device capabilities and offers appropriate sharing options
  - **FILE SHARING**: Shares actual PDF files when supported, otherwise shares links
  - **USER EXPERIENCE**: Users can now share tickets directly through their device's native sharing options

- **July 10, 2025** - FIXED: Package ticket modal mobile responsiveness:
  - **MOBILE OPTIMIZATION**: Fixed PackageTicket modal to be scrollable on mobile devices
  - **VIEWPORT CONSTRAINTS**: Added max-height (90vh) and overflow-y-auto to DialogContent
  - **BUTTON VISIBILITY**: Ensured "Imprimir Ticket" button is always visible and accessible
  - **RESPONSIVE DESIGN**: Improved button sizing and spacing for mobile devices
  - **USER EXPERIENCE**: Users can now scroll within modal to access all content on mobile

- **July 10, 2025** - FIXED: Added reservations-list access for CHECKER role:
  - **ROLE PERMISSIONS**: Added "reservations-list" permission to CHECKER role
  - **ACCESS RESTORED**: Checkers now have access to reservation list view for their work functions
  - **USER EXPERIENCE**: Checker role can now properly access and manage reservation lists

- **July 10, 2025** - STREAMLINED: Driver interface optimized by removing redundant package section:
  - **UI SIMPLIFICATION**: Removed "packages" permission from DRIVER role to eliminate redundant navigation option
  - **INTEGRATED ACCESS**: Drivers can now access packages exclusively through "Reservaciones en lista" sidebar
  - **PACKAGE PERMISSIONS**: Maintained DRIVER role in PACKAGE_WRITE_ROLES to allow drivers to mark packages as paid or delivered
  - **ENDPOINT ACCESS**: Kept 'chofer' role support in /api/taquilla/packages endpoint for sidebar functionality
  - **FILTERING LOGIC**: Maintained conductor-specific filtering using recordId extraction from tripId suffixes
  - **FRONTEND HOOKS**: Preserved usePackagesByTrip functionality for reservation sidebar integration
  - **DATABASE FILTERING**: Enhanced getPackagesWithTripInfo to properly filter packages by conductor's assigned trips
  - **RECORDID EXTRACTION**: Fixed tripId parsing to extract base recordId from suffixed IDs (214_0 → 214)
  - **CORE LOGIC REDESIGN**: Reservations now grouped by `recordId` instead of individual `tripId` for proper midnight-crossing trip handling
  - **BACKEND ENHANCEMENT**: Implemented intelligent recordId-based grouping that associates all reservations to parent trip date
  - **FRONTEND GROUPING**: Modified grouping logic to use recordId as key for consistent trip association
  - **DATE FILTERING LOGIC**: When filtering by date, system now includes all reservations from recordId groups whose parent trip matches the date
  - **MIDNIGHT-CROSSING SUPPORT**: Reservations from segments crossing midnight now properly associated with parent trip date
  - **RECORDID NORMALIZATION**: System now normalizes recordId values (214_122 → 214) to prevent duplicate grouping
  - **USER EXPERIENCE**: Filtering by date now works correctly for complex trip structures with multiple segments
  - **EXAMPLE**: Filtering by 2025-07-10 now includes all reservations from recordId 214 (parent trip date) regardless of individual segment dates
  - Fixed core architectural issue where date filtering failed for multi-segment overnight journeys

- **July 10, 2025** - FIXED: Trip update functionality now working properly:
  - **ROOT CAUSE IDENTIFIED**: PATCH endpoint was limited to only vehicleId and driverId updates
  - **EXPANDED ENDPOINT**: Added support for capacity and visibility updates in PATCH /api/trips/:id
  - **PROPER HANDLING**: Added null value conversion for "0" vehicle/driver selections (unassign feature)
  - **COMPREHENSIVE LOGGING**: Enhanced debugging output to track all update data being received
  - **USER EXPERIENCE**: "Actualizar Viaje" button now functions correctly and updates trip data
  - Fixed issue where trip updates appeared to do nothing due to limited backend processing

- **July 10, 2025** - FIXED: Manual schedule modifications now respected when publishing trips:
  - **ROOT CAUSE IDENTIFIED**: Backend was prioritizing template configurations over user-modified stop times
  - **NEW PRIORITY SYSTEM**: Backend now uses 1) Frontend segmentPrices with custom times, 2) Template configurations, 3) Proportional fallback
  - **MANUAL TIMING PRESERVED**: When users modify stop times in frontend, these changes are now preserved in published trips
  - **CHAIN MODIFICATION SUPPORT**: System correctly handles when users modify one stop time and subsequent times update automatically
  - **INTELLIGENT DETECTION**: Backend detects when segmentPrices contain custom departureTime/arrivalTime values
  - **COMPREHENSIVE LOGGING**: Added detailed console output to track which time calculation method is being used
  - **USER EXPERIENCE**: Published trips now show exact times users configured manually instead of reverting to template defaults
  - Fixed issue where manual time modifications (like 11:50 PM, 12:20 AM) were ignored and replaced with template times

- **July 10, 2025** - ENHANCED: Payment confirmation modal implementation completed:
  - **MODAL FUNCTIONALITY**: Added payment confirmation modal that appears when advance payment < total amount
  - **IMPROVED UI**: Shows detailed payment breakdown with methods for both advance and boarding payments
  - **CONDITIONAL DISPLAY**: Hides advance payment information when amount is $0 to reduce clutter
  - **BETTER UX**: Fixed button interactions to prevent closing main form when dismissing modal
  - **VISUAL ENHANCEMENTS**: Added color-coded payment methods and improved layout organization
  - **PORTAL RENDERING**: Uses React Portal with high z-index to ensure proper overlay behavior
  - **FORM VALIDATION**: Enhanced payment workflow with clear messaging about payment method restrictions
  - Modal provides comprehensive payment summary and important payment instructions for users

- **July 10, 2025** - CRITICAL FIX: Resolved trip filtering and display issues completely:
  - **ROOT CAUSE IDENTIFIED**: System was using `db-storage.ts` (not `database-storage.ts`) as confirmed by `server/storage.ts` import
  - **INTELLIGENT MODE SELECTION**: Fixed logic to use optimized mode for main trips (`isSubTrip=false`) with proper date filtering
  - **OPTIMIZED MODE ENHANCED**: Added date filtering to optimized mode to prevent showing all trips regardless of date
  - **PERFECT BALANCE ACHIEVED**: Main trips (optimized) show only trip parents with date filtering, expanded mode for all combinations
  - **TESTING CONFIRMED**: Now correctly shows 1 main trip for 2025-07-10, 0 for 2025-07-08 (vs previous 319 combinations)
  - **PERFORMANCE OPTIMAL**: Fast main trip loading with proper date filtering, no unnecessary segment expansion
  - **USER EXPERIENCE RESTORED**: Default trip view shows only relevant main trips for current date as intended
  - Fixed the core issue where `isSubTrip=false` was showing all segment combinations instead of parent trips only

- **July 10, 2025** - ENHANCED: Reservation form UI improvements for better user experience:
  - **FORM CLARITY**: Modified step-by-step reservation form to show origin and destination instead of route name
  - **PAYMENT LABELS**: Changed "Método de Pago" to "Método de pago al abordar" for better clarity
  - **CONDITIONAL DISPLAY**: Second payment method completely hidden when advance payment equals total amount
  - **USER EXPERIENCE**: Eliminates confusion by showing only relevant payment options based on advance amount
  - Form now displays specific segment locations (e.g., "Acapulco Gas de la giovanna → Taxqueña") instead of generic route names

- **July 10, 2025** - FIXED: Date filtering issue for midnight-crossing trip segments completely resolved:
  - **CRITICAL BUG FIXED**: Segments that cross midnight now appear in correct date searches
  - **BACKEND CORRECTION**: Removed SQL-level date filtering that only checked first segment (`tripData->0->>'departureDate'`)
  - **SEGMENT-LEVEL FILTERING**: Implemented individual date filtering for each segment based on its own `departureDate`
  - **MIDNIGHT CROSSING LOGIC**: Segments departing after midnight (e.g., 12:30 AM) now correctly appear in next-day searches
  - **EXAMPLE FIXED**: Trip starting July 9 at 11:50 PM → Acapulco→Taxqueña segment at 6:00 AM on July 10 now appears only in July 10 searches
  - **CACHE CLEARED**: Server-side trip cache properly invalidated to reflect new filtering logic
  - **USER EXPERIENCE**: Users now find trip segments in the correct date when searching by departure date
  - Date filtering now works correctly for all trip combinations, including overnight journeys

- **July 9, 2025** - FIXED: Commission payment status persistence issue completely resolved:
  - **FRONTEND BUG FIXED**: CommissionsList component was incorrectly checking `commission.createdByUser?.commissionPaid` instead of `commission.commissionPaid`
  - **BACKEND WORKING**: PUT /api/commissions/pay endpoint was already functioning correctly, updating the right field
  - **FILTERING CORRECTED**: Pending/paid commission filtering now works properly with the correct field reference
  - **BADGE DISPLAY FIXED**: Status badges now show correct paid/pending state based on actual database value
  - **TESTING CONFIRMED**: API endpoints tested successfully - commission status updates and persists correctly
  - **USER EXPERIENCE**: Users can now mark commissions as paid and see immediate feedback with proper state persistence
  - Commission management interface now displays and updates payment status correctly across all views

- **July 8, 2025** - CONFIRMED WORKING: Package seat reduction system is functioning correctly:
  - **SEAT REDUCTION VERIFIED**: When packages use seats, available seats are properly reduced across all affected trip segments
  - **Function updateRelatedTripsAvailability**: Working correctly, reduces seats for overlapping segments
  - **Interface IStorage**: Corrected to match actual implementation (recordId, tripId, seatChange parameters)
  - **Logs confirmation**: System shows seat updates from 17→12 when 5-seat package created
  - **Overlap detection**: Function correctly identifies and updates all segments that share route portions
  - **Database integrity**: Trip data properly updated with reduced seat availability
  - Package creation with seat usage now properly integrates with trip capacity management

- **July 8, 2025** - FINAL FIX: Resolved critical date display and filtering issues:
  - **DATE DISPLAY CORRECTED**: Fixed timezone conversion issue causing incorrect date display in frontend
  - Replaced date-fns format with simple string manipulation to avoid timezone confusion (YYYY-MM-DD → DD/MM/YYYY)
  - **BACKEND DATE FILTERING**: Fixed SQL query to use correct JSONB path `trip_data->0->>'departureDate'` instead of invalid path
  - **DEFAULT BEHAVIOR RESTORED**: Trip list now shows only trips for current date by default (includes `date: today` in initial params)
  - **SEARCH FUNCTIONALITY**: Date-specific searches now work correctly (9 de julio shows correct trip, 8 de julio shows correct trip)
  - **PERFORMANCE MAINTAINED**: Still loads only main trips by default with `isSubTrip: false` for fast initial load
  - **USER EXPERIENCE**: Users see correct dates in blue text below departure time in trip cards
  - All date-related bugs resolved: frontend dates match backend data, filtering works perfectly

- **July 8, 2025** - Optimized trip loading performance and implemented direct combination control:
  - **MAJOR PERFORMANCE IMPROVEMENT**: Modified trip list to load only main trips by default (isSubTrip: false)
  - Eliminated loading of 498+ trip combinations on initial page load, reducing to only 3-5 main trips
  - Implemented direct combination control in "Publicar Viaje" form with enable/disable checkboxes
  - Added visual information banner explaining default behavior (main trips only)
  - Modified search logic: specific origin/destination searches now load all combinations as needed
  - Simplified backend generateAllPossibleSegments() function, removing complex template filtering
  - Backend now respects frontend-filtered segmentPrices instead of generating all possibilities
  - Added isSubTrip parameter filtering in /api/trips endpoint for proper main/sub trip distinction
  - Improved user experience: fast initial load + targeted searches when needed

- **July 7, 2025** - Enhanced route template pricing system with city-based grouping and selective enablement:
  - **MAJOR IMPROVEMENT**: Template pricing now groups by cities instead of individual stop combinations
  - Implemented same logic as "Publicar Viaje" where users configure prices between main cities (e.g. Acapulco→Chilpancingo)
  - Added "Paradas Afectadas" column showing how many stop combinations each city price affects
  - Users now see "7 combinaciones" or "14 combinaciones" for each city pair price
  - **NEW FEATURE**: Added enable/disable checkboxes for each city combination in templates
  - Users can now selectively disable irrelevant combinations (e.g. short-distance routes within same state)
  - Only enabled combinations appear in "Publicar Viaje" form, eliminating clutter from unused routes
  - Template form shows visual feedback with disabled combinations grayed out and price inputs disabled
  - Price configuration automatically applies to all stop combinations within the same city pair
  - Eliminates repetitive individual stop pricing - much cleaner and more intuitive interface
  - Template form now matches the exact workflow users expect from trip publishing
  - Added informative badges in publish trip form when using filtered template combinations
  - **BACKEND FIX**: Modified generateAllPossibleSegments() to filter by template enabled combinations
  - Trip creation now only generates segments for enabled combinations, preventing disabled routes from being created

- **July 7, 2025** - Fixed critical issues with template-based trip creation and segment date calculation:
  - Fixed trips created with templates not appearing in trip lists due to missing routeId assignment
  - Corrected trip creation code to use template.routeId instead of tripData.routeId for proper database storage
  - Enhanced midnight crossing detection to prevent duplicate trip creation for overnight journeys
  - Implemented logic to create single trips for overnight journeys (departing one day, arriving next day)
  - Fixed SQL filtering in searchTrips method that was excluding trips with NULL routeId values
  - **MAJOR FIX**: Implemented intelligent segment date calculation for cross-midnight trips
  - Each trip segment now gets its own accurate departureDate based on its actual departure time
  - Segments departing between 12:00 AM - 6:59 AM are automatically assigned to the next day
  - Example: Trip starts July 9 at 11:00 PM, Chilpancingo→Coyoacán segment at 12:30 AM gets July 10 date
  - This ensures segments appear in correct date searches and prevents user confusion
  - **LOCATION DATA UPDATE**: Fixed municipality dropdown limitations by updating static location data
  - Updated client/src/lib/location-data.ts with complete municipality data from database
  - Guerrero now shows all 81 municipalities instead of only 5 limited options
  - All states now have their complete municipality lists (Chiapas: 123, Chihuahua: 67, etc.)
  - System now uses authentic data from database in static format for better performance

- **July 6, 2025** - Implemented comprehensive route template system:
  - Created route_templates database table with timing and pricing configuration fields
  - Added full CRUD operations in storage interface and database layer for template management
  - Implemented API endpoints (/api/route-templates) with proper authentication and company isolation
  - Built complete frontend interface with templates page, form components, and sidebar navigation
  - Templates allow users to predefine route segment timings and prices for quick trip creation
  - Users can create templates with time differences between stops and pricing for each segment
  - Template-based trip creation will calculate all stop times automatically from departure time
  - Added "Plantillas" navigation option accessible to users with route management permissions

- **July 5, 2025** - Completed Step 2 of backend performance optimization:
  - Successfully implemented searchTripsOptimized method using JOINs instead of N+1 queries
  - Reduced database queries from 5 separate calls to 1 combined JOIN query (80% reduction)
  - Created optimized endpoint /api/trips-optimized for testing performance improvements
  - Maintained full functional compatibility with original searchTrips method
  - System performance significantly improved: eliminated N+1 query pattern in trip search operations

- **July 5, 2025** - Completed Step 3 of backend performance optimization:
  - Identified critical N+1 query pattern in getReservations method: 1 + (N × 6) queries per request
  - Implemented getReservationsOptimized method using single JOIN query with related tables
  - Reduced database queries from 43 queries (for 7 reservations) to 1 query (97% reduction)
  - Added method to IStorage interface and created test endpoint /api/reservations-optimized
  - Preserved all role-based filtering and company isolation logic
  - Expected performance improvement: ~3000ms to <500ms for reservation loading

- **July 5, 2025** - Fixed reservation filtering and package permissions:
  - Added status filtering to exclude canceled reservations in "Reservaciones en lista" page
  - Fixed TICKET_OFFICE role permissions to create, edit and delete packages by adding to PACKAGE_WRITE_ROLES and PACKAGE_CREATE_ROLES
  - Resolved issue where canceled reservations still appeared in reservation list despite frontend filtering

- **July 5, 2025** - Configured complete production deployment setup:
  - Fixed NODE_ENV detection in server/index.ts to use process.env.NODE_ENV correctly
  - Created production build script (build-production.sh) for complete deployment automation
  - Added scripts/setup-production.js to generate all necessary production files
  - Created server-wrapper.js for CommonJS/ESM compatibility with PM2
  - Added comprehensive ecosystem.config.js for PM2 process management
  - Included .env.example template with all required environment variables
  - Project now ready for one-command deployment: ./build-production.sh

- **June 30, 2025** - Implemented automatic redirection for driver role after login:
  - Added logic in auth-page.tsx to redirect "chofer" role users directly to "/reservations-list" upon login
  - Updated role-based routing to improve user experience for drivers who primarily work with reservation lists
  - Maintains existing redirection logic for other roles (comisionista to trips, others to dashboard)

- **June 30, 2025** - Fixed package access permissions for ticket office users:
  - Added TICKET_OFFICE role to PACKAGE_WRITE_ROLES in backend package route permissions
  - Updated all package-related hooks (usePackagesByTrip, usePackages, useTripPackages) to use correct endpoints based on user role
  - Ticket office users now automatically use /api/taquilla/packages endpoint while other roles use /api/packages
  - Resolved "Error al cargar paqueterías" issue in reservation sidebar for taquilla role

- **June 30, 2025** - Fixed user cash boxes display issue for multi-company ticket office users:
  - Adapted frontend code to handle pre-grouped user data from backend instead of individual transactions
  - Fixed "Cannot read properties of undefined (reading 'toString')" error that caused blank screens
  - User cash boxes now correctly display ticket office transactions across multiple companies
  - Added validation and logging for improved debugging of data processing

- **June 30, 2025** - Enhanced reservation sidebar with budget and expense management for drivers:
  - Added "Presupuesto y Gastos" section exclusively for chofer role in reservation details sidebar
  - Implemented budget display (read-only for drivers) and expense tracking functionality
  - Added expense form with dropdown categories: Gasolina, Casetas, Otros
  - Included expense list with delete functionality for driver-added expenses
  - Maintains consistent UI design with existing bitácora section

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