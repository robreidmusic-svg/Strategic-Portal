# Email Ingestion Setup (PDI 2026 Edition)

To enable forwarding articles and documents directly to your Strategic Intelligence Agent using the **`PDI2026`** tag, follow these steps.

## 1. Create a Gmail Filter (The "Tag Listener")
This allows anyone to forward content to you. If the email contains the tag, it will be automatically queued for the agent.

1. Open your Gmail settings and go to **Filters and Blocked Addresses**.
2. Click **Create a new filter**.
3. In the **Has the words** field, enter: `PDI2026`
4. Click **Create filter**.
5. Check **Apply the label** and choose **New label...**. Name it exactly **`Strategic-Ingestion`**.
6. Click **Create filter**.

*Now, any email sent to you with "PDI2026" anywhere in it will be ready for ingestion.*

## 2. Deploy the Ingestion Script
1. Go to [script.google.com](https://script.google.com).
2. Click **New Project**.
3. Replace the default code with the script below.
4. Replace `YOUR_APP_URL` and `YOUR_WEBHOOK_KEY` with your actual values.
5. Click **Deploy > New Deployment** (Type: Web App, Access: Anyone).
6. **Set a Trigger**: Click the clock icon (Triggers) and add a trigger for `pollEmails` to run every 5 minutes.

### The Bridge Script
```javascript
const CONFIG = {
  APP_URL: "https://ais-dev-csn5ykh4rjojgsf645y5vm-107198508797.europe-west3.run.app", 
  WEBHOOK_KEY: "SET_IN_SECRETS", 
  LABEL_NAME: "Strategic-Ingestion"
};

function pollEmails() {
  const label = GmailApp.getUserLabelByName(CONFIG.LABEL_NAME);
  const threads = label.getThreads();
  
  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];
      
      const payload = {
        key: CONFIG.WEBHOOK_KEY,
        subject: msg.getSubject(),
        body: msg.getPlainBody(),
        from: msg.getFrom(),
        date: msg.getDate()
      };
      
      try {
        UrlFetchApp.fetch(CONFIG.APP_URL + "/api/ingest-email", {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload)
        });
        threads[i].removeLabel(label);
      } catch (e) {
        Logger.log("Error: " + e.message);
      }
    }
  }
}
```

