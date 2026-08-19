# MediQA

MediQA is a lightweight landing page for connecting medical device and digital health teams with real medical professionals for fast product feedback before formal usability evaluation.

The public site intentionally stays small:

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

## Production

GitHub Pages serves the public site at:

```text
https://mediqa.mannlab.app
```

The custom domain is configured through `public/CNAME`, which is included in the Pages artifact.

## Google Sheets Storage

1. Create a private Google Sheet.
2. Open `Extensions` -> `Apps Script`.
3. Paste `google-apps-script/Code.gs`.
4. Run `setupMediqaSheets()` once.
5. Deploy as a Web App.
6. Put the Web App `/exec` URL into `public/config.js` for private/local deployment.

For the public repository, `public/config.js` keeps `appsScriptUrl` blank so the write endpoint is not exposed in source.
