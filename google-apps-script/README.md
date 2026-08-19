# MediQA Google Sheets Setup

This setup keeps the MediQA landing page experience custom while storing form submissions and events in a personal Google Sheet.

## 1. Create the Sheet

Create a new Google Sheet in your personal Drive:

`MediQA Private Validation`

You do not need to create tabs manually. The Apps Script setup function will create:

- `Clinician Registrations`
- `Company Pilots`
- `Events`
- `Errors`

## 2. Add Apps Script

Open the sheet, then go to:

`Extensions` -> `Apps Script`

Replace the default code with the contents of:

`google-apps-script/Code.gs`

Run `setupMediqaSheets()` once from Apps Script. Google will ask for authorization.

## 3. Optional Email Notifications

To receive an email when a medical professional registration or company free pilot request is submitted:

1. Run `setMediqaNotificationEmail()` once from Apps Script.
2. Run `sendMediqaNotificationTest()` once from Apps Script.
3. Approve the MailApp permission prompt.
4. Confirm that the test email arrives at `daga4242@gmail.com`.

Events such as `landing_view` are not emailed. Only actual form submissions trigger email notifications.
If email sending fails during a form submission, the error is written to the `Errors` tab.

## 4. Deploy as Web App

In Apps Script:

`Deploy` -> `New deployment` -> `Web app`

Recommended settings:

- Description: `MediQA intake endpoint`
- Execute as: `Me`
- Who has access: `Anyone`

Copy the generated Web App URL.

## 5. Connect the Landing Page

Open:

`public/config.js`

Paste the Web App URL into `appsScriptUrl`.

```js
window.MEDIQA_CONFIG = {
  appsScriptUrl: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
};
```

When this URL is present, MediQA submits events and form responses to Google Sheets. When it is empty, the local Node server stores data in `data/*.jsonl`.

## Notes

- Browser-to-Apps-Script submission uses a no-CORS POST so the page can work without a separate backend server.
- Because of that browser limitation, the page can confirm that the request was dispatched, but it cannot fully inspect the Apps Script response.
- Failed Apps Script parsing attempts are written to the `Errors` tab when the script receives them.
- Keep the sheet private. The Web App endpoint accepts writes, so avoid publishing the URL outside the landing page source.
