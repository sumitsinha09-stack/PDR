# AWS "Ship It" Deployment Guide: PDR Platform

This guide provides end-to-end instructions for deploying PDR with a public frontend URL and backend API URL on AWS.

```
                  ┌───────────────────────────────┐
                  │      AWS Amplify Hosting       │
                  │   React/Vite Frontend (SPA)   │
                  └───────────────┬───────────────┘
                                  │ HTTPS (VITE_BACKEND_URL)
                                  ▼
                  ┌───────────────────────────────┐
                  │        AWS App Runner         │
                  │   FastAPI Backend (Port 8000) │
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ ML Models (PKL) │      │ Amazon DynamoDB │      │    Amazon S3    │
│  NTC & MSME     │      │ (Applicant DB)  │      │ (Report Storage)│
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 1. Prepare and Push to GitHub

Ensure all files are committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "chore: prepare for AWS Ship It deployment"
git push origin main
```

Verified deployment assets:
- `Dockerfile` (Container-based App Runner deployment)
- `apprunner.yaml` (Source repository App Runner deployment)
- `amplify.yml` (AWS Amplify build specification)
- `requirements.txt` (Python backend dependencies)
- `pdr-frontend/package.json` (Vite / React frontend)

---

## 2. Deploy Backend on AWS App Runner

You can deploy the backend using **Option A (Source Code - Recommended)** or **Option B (Container Image)**.

### Option A: Source Code Repository (Easiest)

1. Open the [AWS App Runner Console](https://console.aws.amazon.com/apprunner).
2. Click **Create service**.
3. In **Source**:
   - Select **Source code repository**.
   - Connect your GitHub account and select your repository (`PDR-publishing`).
   - Branch: `main`
   - Deployment trigger: **Automatic** (or Manual).
4. In **Configuration**:
   - Select **Use a configuration file**.
   - App Runner will automatically detect `apprunner.yaml` in the repo root.
5. In **Service settings**:
   - Service name: `pdr-backend`
   - Virtual CPU & Memory: `1 vCPU, 2 GB` (sufficient for ML model inference).
   - Port: `8000` (auto-configured from `apprunner.yaml`).
6. In **Health check** (optional customization):
   - Path: `/health` (or `/` — both return HTTP 200).
   - Interval: `10` seconds, Timeout: `5` seconds.
7. Click **Create & deploy**.
8. Wait for deployment to complete (~3-5 minutes).
9. Copy your **Default domain** URL (e.g., `https://xxxxxx.us-east-1.awsapprunner.com`).

### Option B: Container Image (via ECR)

If you prefer deploying via Docker container:
1. Build and tag the Docker container locally:
   ```bash
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account_id>.dkr.ecr.<region>.amazonaws.com
   docker build -t pdr-backend .
   docker tag pdr-backend:latest <account_id>.dkr.ecr.<region>.amazonaws.com/pdr-backend:latest
   docker push <account_id>.dkr.ecr.<region>.amazonaws.com/pdr-backend:latest
   ```
2. In App Runner console, select **Container registry** > **Amazon ECR**.
3. Choose the image tag `pdr-backend:latest`.
4. Set Port to `8000`.

### Verify Backend:
Open your browser or terminal and test:
```bash
curl -f https://<YOUR-APP-RUNNER-URL>/health
```
Expected response:
```json
{
  "status": "ok",
  "model_loaded": true,
  "setu_ready": true,
  "timestamp": "..."
}
```

---

## 3. Deploy Frontend on AWS Amplify Hosting

1. Open the [AWS Amplify Console](https://console.aws.amazon.com/amplify).
2. Click **Host web app** (or **Add new app** > **Host an app**).
3. Choose **GitHub** and authorize access.
4. Select repository: `PDR-publishing`, branch: `main`.
5. Amplify will auto-detect the build settings from the repository's `amplify.yml`.
6. Expand **Advanced settings** (or **Environment variables**):
   - Add environment variable:
     - **Key**: `VITE_BACKEND_URL`
     - **Value**: `https://<YOUR-APP-RUNNER-URL>` (e.g., `https://xxxxxx.us-east-1.awsapprunner.com`)
     > Note: Do not include a trailing slash. If you do, `config.js` will automatically sanitize it.
7. Click **Save and deploy**.
8. Wait for all steps (**Provision**, **Build**, **Deploy**) to succeed.

### Essential Step: Configure SPA Rewrites/Redirects in Amplify

Because PDR is a Single Page Application (SPA) using React Router (`react-router-dom`), configure URL rewrites so subpaths (such as `/manager-dashboard` or `/user-status`) reload without returning 404:
1. In the Amplify console, navigate to **App settings** > **Rewrites and redirects**.
2. Click **Add rule** or edit existing:
   - **Source address**: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>`
   - **Target address**: `/index.html`
   - **Type**: `200 (Rewrite)`
3. Save the rule.

---

## 4. Environment Variables Reference

### Backend (AWS App Runner)
| Variable | Value / Description | Required? |
| :--- | :--- | :--- |
| `PORT` | Managed automatically by App Runner (defaults to `8000`) | System-set |
| `SETU_CLIENT_ID` | Setu AA Client ID (has default fallback in code) | Optional |
| `SETU_CLIENT_SECRET` | Setu AA Client Secret (has default fallback in code) | Optional |
| `SETU_PRODUCT_ID` | Setu AA Product ID (has default fallback in code) | Optional |

### Frontend (AWS Amplify)
| Variable | Value / Description | Required? |
| :--- | :--- | :--- |
| `VITE_BACKEND_URL` | Public App Runner URL (e.g. `https://xxxx.awsapprunner.com`) | **Yes** |

---

## 5. Final Testing Checklist

- [ ] Backend `/` endpoint returns HTTP 200.
- [ ] Backend `/health` endpoint returns `{"status":"ok","model_loaded":true,...}`.
- [ ] Backend demo endpoint `/demo/user_001` returns scored profile with persona and grade.
- [ ] Frontend loads from the Amplify domain (`https://main.xxxx.amplifyapp.com`).
- [ ] Frontend network tab shows requests going to `https://xxxx.awsapprunner.com/...`, NOT `localhost`.
- [ ] Demo profiles page (`/demo`) scores applicants in real-time.
- [ ] Manager portal (`/manager-dashboard`) lists applicants and updates decisions.
- [ ] Refreshing browser on `/manager-dashboard` or `/user-status` loads cleanly (SPA rewrite verified).
