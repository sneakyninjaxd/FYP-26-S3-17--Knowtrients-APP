KNOWTRIENTS - SETUP & TESTING GUIDE

=== 1. PREREQUISITES (install these first) ===

Node.js - check with: node --version
Install from: nodejs.org
Git - check with: git --version
Install from: git-scm.com
Expo Go app on your phone - App Store or Google Play

Restart your terminal after installing anything new.

=== 2. CLONE THE REPO ===

git clone https://github.com/uwaht/FYP-26-S3-17--Knowtrients-APP.git
cd FYP-26-S3-17--Knowtrients-APP

=== 3. INSTALL DEPENDENCIES ===

npm install

(Warnings about deprecated packages or vulnerabilities are normal, ignore them)

=== 4. SET UP YOUR ENVIRONMENT FILE ===

Open the .env file and make sure it has:
EXPO_PUBLIC_API_URL=https://knowtrients-backend-database.onrender.com

This points your app at the shared live backend. You don't need to run anything locally for the API or database.

=== 5. START THE APP ===

npx expo start

Then choose one:

Press w = opens in your web browser (fastest to test)
Scan the QR code with Expo Go on your phone (must be on same WiFi as your computer)
Press a = Android emulator (only if you have Android Studio set up)

=== 6. TEST IT ===

You should land on the Create Account screen
Fill in an email, name, and password (8+ characters)
Tap Create Account
If it works, you'll be logged in and land on the tabs/dashboard screen
Try logging out and back in via the Login screen too

=== TROUBLESHOOTING ===

"Could not reach the server" error:

Confirm .env has the exact URL from step 4, no typos
Restart with cache cleared: stop the server (Ctrl+C), run: npx expo start --clear
On Expo Go: fully close the app (swipe away, don't just background it) before rescanning the QR code

App hangs 30-60 seconds on first use:

Normal. The backend is on a free tier that sleeps after 15 min idle and takes a moment to wake up. Just wait.

Password rejected on signup:

Must be 8+ characters, and Password/Retype Password must match exactly

QR code won't load app on phone:

Confirm phone and computer are on the same WiFi
Some public/school WiFi blocks device-to-device connections - try a personal hotspot instead

Still stuck? Message the group with:

Screenshot of the exact error
Whether you're testing on web, Expo Go, or emulator
The output of npx expo start from your terminal

=== CHECKING THE RAW API DIRECTLY ===

https://knowtrients-backend-database.onrender.com/docs

This is an interactive API explorer, useful for confirming whether an issue is in the app or the backend.

=== VIEWING THE DATABASE DIRECTLY (OPTIONAL, FOR DEBUGGING) ===

Get added to the Render project first
Ask whoever manages Render to invite you as a member of the workspace.
Install DBeaver
Download DBeaver Community Edition from dbeaver.io/download (default install options are fine)
Get connection details from Render
Log into render.com with your invited account
Go to the Postgres database service (not the web service)
Find Connect > External Connection details:
Hostname (ends in .render.com)
Port: 5432
Database name
Username
Password
Create the connection in DBeaver
Open DBeaver, click New Database Connection icon (top-left)
Select PostgreSQL, click Next
Fill in Host, Port (5432), Database, Username, Password from step 3
Go to the SSL tab, set SSL Mode to: require
Click Test Connection (let it download the PostgreSQL driver if prompted)
Click Finish
Browse the data
In the sidebar, expand:
Your connection > Databases > (database name) > Schemas > public > Tables > users
Double-click users to see all rows. Right-click > Refresh (or press F5) to reload after a new test signup.

IMPORTANT: Don't share these credentials outside the team, and don't post them in public channels or commit them to code.
