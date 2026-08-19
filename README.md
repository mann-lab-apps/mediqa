# MediQA MVP

MediQA is a lightweight MVP landing page for validating whether medical device and digital health teams want fast product feedback from real medical professionals before formal usability evaluation.

The MVP intentionally stays small:

- Landing page
- Medical professional registration form
- Company free pilot request form
- UTM preservation
- Event tracking
- Optional Google Apps Script -> Google Sheets storage
- Local JSONL fallback during development

## Run Locally

```sh
npm start
```

Open:

```text
http://127.0.0.1:5178
```

## Google Sheets Storage

1. Create a private Google Sheet.
2. Open `Extensions` -> `Apps Script`.
3. Paste `google-apps-script/Code.gs`.
4. Run `setupMediqaSheets()` once.
5. Deploy as a Web App.
6. Put the Web App `/exec` URL into `public/config.js` for private/local deployment.

For the public repository, `public/config.js` keeps `appsScriptUrl` blank so the write endpoint is not exposed in source.
