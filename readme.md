AI Fashion Styler - Deployment Guide
Follow these steps to deploy your application to Netlify using the GitHub web interface (no command line needed).

Step 1: Create a GitHub Repository
Go to GitHub and sign in.

Click the + icon in the top-right corner and select "New repository".

Give your repository a name (e.g., ai-fashion-styler).

Keep it Public.

Click "Create repository".

Step 2: Upload Project Files
On your new repository's page, click the "Add file" button and select "Upload files".

You will see a box where you can drag and drop files.

Drag and drop all the files I've provided (package.json, vite.config.js, index.html, and the src folder containing App.jsx and main.jsx) into this box.

Once the files are uploaded, click "Commit changes".

Step 3: Deploy with Netlify
Go to Netlify and sign up using your GitHub account.

After signing in, click on "Add new site" and then "Import an existing project".

Choose "GitHub" as your provider.

Find and select the repository you just created (ai-fashion-styler).

Netlify will automatically detect that this is a Vite project and fill in the build settings. They should be:

Build command: npm run build

Publish directory: dist

Before deploying, you must add your secret keys. Click on "Show advanced", then "New variable". You need to add the following variables:

VITE_API_KEY: Paste your actual Google AI API key here.

VITE_FIREBASE_CONFIG: Paste the entire Firebase configuration object here (as a single line of JSON).

VITE_APP_ID: Enter a unique name for your app (e.g., ai-fashion-styler-prod).

Click the "Deploy site" button.

Netlify will now build and deploy your application. In a few minutes, it will provide you with a public URL where you can access your live AI Fashion Styler!
