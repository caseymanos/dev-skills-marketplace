# Kubernetes Configuration Examples

Complete examples for deploying the development environment on Kubernetes.

## Namespace

```yaml
# k8s/dev/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dev-env
```

## ConfigMap

```yaml
# k8s/dev/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: dev-env
data:
  POSTGRES_PORT: "5432"
  REDIS_PORT: "6379"
  API_PORT: "8000"
  FRONTEND_PORT: "3000"
  DB_NAME: "dev_db"
  LOG_LEVEL: "debug"
  ENABLE_HOT_RELOAD: "true"
```

## Secrets

```yaml
# k8s/dev/secrets.yaml
# WARNING: These are mock secrets for development only
# Never commit real secrets to version control
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: dev-env
type: Opaque
stringData:
  DB_USER: "dev_user"
  DB_PASSWORD: "dev_password_change_in_production"
  REDIS_PASSWORD: ""  # Redis without auth in dev
```

## PostgreSQL Deployment

```yaml
# k8s/dev/postgres-deployment.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: dev-env
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: standard  # Adjust for your cluster
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: dev-env
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - $(POSTGRES_USER)
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - $(POSTGRES_USER)
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: dev-env
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: postgres
```

## Redis Deployment

```yaml
# k8s/dev/redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: dev-env
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: dev-env
spec:
  type: ClusterIP
  ports:
  - port: 6379
    targetPort: 6379
  selector:
    app: redis
```

## Backend API Deployment

```yaml
# k8s/dev/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: dev-env
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: your-api-image:latest  # Replace with your image
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          value: "postgres://$(DB_USER):$(DB_PASSWORD)@postgres:5432/$(DB_NAME)"
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        - name: DB_NAME
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: dev-env
spec:
  type: ClusterIP
  ports:
  - port: 8000
    targetPort: 8000
  selector:
    app: api
```

## Frontend Deployment

```yaml
# k8s/dev/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: dev-env
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: your-frontend-image:latest  # Replace with your image
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
        env:
        - name: VITE_API_URL
          value: "http://api:8000"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: dev-env
spec:
  type: LoadBalancer  # Use NodePort or Ingress in production
  ports:
  - port: 3000
    targetPort: 3000
  selector:
    app: frontend
```

## Deployment Script

```bash
#!/bin/bash
# k8s/deploy-dev.sh

set -e

echo "🚀 Deploying development environment to Kubernetes..."

# Apply configurations in order
kubectl apply -f k8s/dev/namespace.yaml
kubectl apply -f k8s/dev/configmap.yaml
kubectl apply -f k8s/dev/secrets.yaml

# Deploy infrastructure
kubectl apply -f k8s/dev/postgres-deployment.yaml
kubectl apply -f k8s/dev/redis-deployment.yaml

# Wait for infrastructure
echo "⏳ Waiting for infrastructure..."
kubectl wait --for=condition=ready pod -l app=postgres -n dev-env --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n dev-env --timeout=120s

# Deploy applications
kubectl apply -f k8s/dev/api-deployment.yaml
kubectl apply -f k8s/dev/frontend-deployment.yaml

# Wait for applications
echo "⏳ Waiting for applications..."
kubectl wait --for=condition=ready pod -l app=api -n dev-env --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend -n dev-env --timeout=120s

echo "✅ Deployment complete!"
echo ""
echo "Access services:"
kubectl get svc -n dev-env
```
