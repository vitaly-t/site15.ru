import { writeFileSync } from 'fs';
import { ConfigMap, Service, Namespace } from 'kubernetes-types/core/v1';
import { Deployment } from 'kubernetes-types/apps/v1';
import { Ingress } from 'kubernetes-types/networking/v1beta1';
import { stringify } from 'yaml';

const enum HostType {
  Prod = `prod`,
  Local = `local`,
}
const HOST_TYPE: HostType = process.env.HOST_TYPE as HostType;
const PROJECT_NAME = process.env.PROJECT_NAME;
const POSTGRES_USER = process.env.POSTGRES_USER;
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
const POSTGRES_INTERNAL_PORT = +(process.env.POSTGRES_INTERNAL_PORT || `5432`);
const POSTGRES_PORT = +(process.env.POSTGRES_PORT || `5432`);
const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE || PROJECT_NAME;
const ROOT_POSTGRES_USER =
  process.env.ROOT_POSTGRES_USER || `${PROJECT_NAME}_admin`;
const ROOT_POSTGRES_PASSWORD =
  process.env.ROOT_POSTGRES_PASSWORD || POSTGRES_PASSWORD;
const DOCKER_STATIC_IMAGE = process.env.DOCKER_STATIC_IMAGE;
const DOCKER_SERVER_IMAGE = process.env.DOCKER_SERVER_IMAGE;
const LETSENCRYPT_EMAIL = process.env.LETSENCRYPT_EMAIL;
const PROJECT_DOMAIN = process.env.PROJECT_DOMAIN;
const PROJECT_SERVER_INGRESS_PATH = process.env.PROJECT_SERVER_INGRESS_PATH;
const PROJECT_STATIC_INGRESS_PATH = process.env.PROJECT_STATIC_INGRESS_PATH;
const PROJECT_STATIC_INGRESS_REWRITE_TARGET =
  process.env.PROJECT_STATIC_INGRESS_REWRITE_TARGET;

const PROJECT_CONFIG = {
  [`./k8s/${HOST_TYPE}/0.namespace.yaml`]: <Namespace>{
    apiVersion: `v1`,
    kind: `Namespace`,
    metadata: {
      name: `${PROJECT_NAME}-${HOST_TYPE}`,
    },
  },
  [`./k8s/${HOST_TYPE}/1.configmap.yaml`]: <ConfigMap>{
    apiVersion: `v1`,
    kind: `ConfigMap`,
    metadata: {
      namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
      name: `${PROJECT_NAME}-config`,
    },
    data: {
      POSTGRES_URL: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres.postgres-${process.env.HOST_TYPE}:${POSTGRES_INTERNAL_PORT}/${POSTGRES_DATABASE}?schema=public`,
    },
  },
  [`./k8s/${HOST_TYPE}/2.static-deployment.yml`]: <Deployment>{
    apiVersion: `apps/v1`,
    kind: `Deployment`,
    metadata: {
      namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
      name: `${PROJECT_NAME}-static`,
      labels: {
        app: `${PROJECT_NAME}-static`,
      },
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          pod: `${PROJECT_NAME}-static-container`,
        },
      },
      template: {
        metadata: {
          namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
          labels: {
            pod: `${PROJECT_NAME}-static-container`,
          },
        },
        spec: {
          containers: [
            {
              name: `${PROJECT_NAME}-static`,
              image: DOCKER_STATIC_IMAGE,
              imagePullPolicy:
                HOST_TYPE === HostType.Local ? `Never` : `Always`,
              ports: [
                {
                  containerPort: 9090,
                },
              ],
              resources: {
                requests: {
                  memory: `64Mi`,
                  cpu: `250m`,
                },
                limits: {
                  memory: `128Mi`,
                  cpu: `500m`,
                },
              },
            },
          ],
          ...(HOST_TYPE === HostType.Local
            ? {}
            : {
                imagePullSecrets: [
                  {
                    name: `regcred`,
                  },
                ],
              }),
        },
      },
    },
  },
  [`./k8s/${HOST_TYPE}/3.server-deployment.yml`]: <Deployment>{
    apiVersion: `apps/v1`,
    kind: `Deployment`,
    metadata: {
      namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
      name: `${PROJECT_NAME}-server`,
      labels: {
        app: `${PROJECT_NAME}-server`,
      },
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          pod: `${PROJECT_NAME}-server-container`,
        },
      },
      template: {
        metadata: {
          namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
          labels: {
            pod: `${PROJECT_NAME}-server-container`,
          },
        },
        spec: {
          containers: [
            {
              name: `${PROJECT_NAME}-server`,
              image: DOCKER_SERVER_IMAGE,
              imagePullPolicy:
                HOST_TYPE === HostType.Local ? `Never` : `Always`,
              ports: [
                {
                  containerPort: 5000,
                },
              ],

              envFrom: [
                {
                  configMapRef: {
                    name: `${PROJECT_NAME}-config`,
                  },
                },
              ],
              resources: {
                requests: {
                  memory: `64Mi`,
                  cpu: `250m`,
                },
                limits: {
                  memory: `128Mi`,
                  cpu: `500m`,
                },
              },
            },
          ],
          ...(HOST_TYPE === HostType.Local
            ? {}
            : {
                imagePullSecrets: [
                  {
                    name: `regcred`,
                  },
                ],
              }),
        },
      },
    },
  },
  [`./k8s/${HOST_TYPE}/4.static-service.yml`]: <Service>{
    kind: `Service`,
    apiVersion: `v1`,
    metadata: {
      namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
      name: `${PROJECT_NAME}-static-service`,
    },
    spec: {
      selector: {
        pod: `${PROJECT_NAME}-static-container`,
      },
      ports: [
        {
          protocol: `TCP`,
          port: 9090,
          targetPort: 9090,
        },
      ],
      type: `ClusterIP`,
    },
  },
  [`./k8s/${HOST_TYPE}/5.server-service.yml`]: <Service>{
    kind: `Service`,
    apiVersion: `v1`,
    metadata: {
      namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
      name: `${PROJECT_NAME}-server-service`,
    },
    spec: {
      selector: {
        pod: `${PROJECT_NAME}-server-container`,
      },
      ports: [
        {
          protocol: `TCP`,
          port: 5000,
          targetPort: 5000,
        },
      ],
      type: `ClusterIP`,
    },
  },
  [`./k8s/${HOST_TYPE}/6.issuer.yml`]: {
    apiVersion: `cert-manager.io/v1alpha2`,
    kind: `ClusterIssuer`,
    metadata: {
      namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
      name: `letsencrypt-${HOST_TYPE}`,
    },
    spec: {
      acme: {
        server: `https://acme-v02.api.letsencrypt.org/directory`,
        email: LETSENCRYPT_EMAIL,
        privateKeySecretRef: {
          name: `letsencrypt-${HOST_TYPE}`,
        },
        solvers: [
          {
            http01: {
              ingress: {
                class: `nginx`,
              },
            },
          },
        ],
      },
    },
  },
  [`./k8s/${HOST_TYPE}/7.server-ingress.yml`]: <Ingress>{
    apiVersion: `networking.k8s.io/v1beta1`,
    kind: `Ingress`,
    metadata: {
      namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
      name: `${PROJECT_NAME}-server-ingress`,
      annotations: {
        [`kubernetes.io/ingress.class`]: `nginx`,
        [`cert-manager.io/cluster-issuer`]: `letsencrypt-${HOST_TYPE}`,
        [`nginx.ingress.kubernetes.io/proxy-read-timeout`]: `1800`,
        [`nginx.ingress.kubernetes.io/proxy-send-timeout`]: `1800`,
        [`nginx.ingress.kubernetes.io/rewrite-target`]: `/api/$2`,
        [`nginx.ingress.kubernetes.io/secure-backends`]: `true`,
        [`nginx.ingress.kubernetes.io/ssl-redirect`]: `true`,
        [`nginx.ingress.kubernetes.io/websocket-services`]: `${PROJECT_NAME}-server-service`,
        [`nginx.org/websocket-services`]: `${PROJECT_NAME}-server-service`,
      },
    },
    spec: {
      tls: [
        {
          hosts: [PROJECT_DOMAIN],
          secretName: `echo-tls`,
        },
      ],
      rules: [
        {
          host: PROJECT_DOMAIN,
          http: {
            paths: [
              {
                path: PROJECT_SERVER_INGRESS_PATH,
                backend: {
                  serviceName: `${PROJECT_NAME}-server-service`,
                  servicePort: 5000,
                },
              },
            ],
          },
        },
      ],
    },
  },
  [`./k8s/${HOST_TYPE}/8.static-ingress.yml`]: <Ingress>{
    apiVersion: `networking.k8s.io/v1beta1`,
    kind: `Ingress`,
    metadata: {
      namespace: `${PROJECT_NAME}-${HOST_TYPE}`,
      name: `${PROJECT_NAME}-static-ingress`,
      annotations: {
        [`kubernetes.io/ingress.class`]: `nginx`,
        [`cert-manager.io/cluster-issuer`]: `letsencrypt-${HOST_TYPE}`,
        [`nginx.ingress.kubernetes.io/proxy-read-timeout`]: `1800`,
        [`nginx.ingress.kubernetes.io/proxy-send-timeout`]: `1800`,
        [`nginx.ingress.kubernetes.io/rewrite-target`]: PROJECT_STATIC_INGRESS_REWRITE_TARGET,
        [`nginx.ingress.kubernetes.io/secure-backends`]: `true`,
        [`nginx.ingress.kubernetes.io/ssl-redirect`]: `true`,
      },
    },
    spec: {
      tls: [
        {
          hosts: [PROJECT_DOMAIN],
          secretName: `echo-tls`,
        },
      ],
      rules: [
        {
          host: PROJECT_DOMAIN,
          http: {
            paths: [
              {
                path: PROJECT_STATIC_INGRESS_PATH,
                backend: {
                  serviceName: `${PROJECT_NAME}-static-service`,
                  servicePort: 9090,
                },
              },
            ],
          },
        },
      ],
    },
  },
};

const DATABASE_CONFIG = {
  [`./k8s/${HOST_TYPE}/postgres/services/global-service.yaml`]: <Service>{
    apiVersion: `v1`,
    kind: `Service`,
    metadata: {
      namespace: `postgres-${HOST_TYPE}`,
      name: `${PROJECT_NAME}-global-postgres`,
      labels: {
        app: `postgres`,
      },
    },
    spec: {
      type: `NodePort`,
      ports: [
        {
          port: POSTGRES_INTERNAL_PORT,
          nodePort: POSTGRES_PORT,
        },
      ],
      selector: {
        app: `postgres`,
      },
    },
  },
  [`./k8s/${HOST_TYPE}/postgres/1.configmap.yaml`]: <ConfigMap>{
    apiVersion: `v1`,
    kind: `ConfigMap`,
    metadata: {
      namespace: `postgres-${HOST_TYPE}`,
      name: `postgres-config`,
      labels: {
        app: `postgres`,
      },
    },
    data: {
      POSTGRES_USER: ROOT_POSTGRES_USER,
      POSTGRES_PASSWORD: ROOT_POSTGRES_PASSWORD,
    },
  },
};

Object.keys(PROJECT_CONFIG).map((file) =>
  writeFileSync(file, stringify(PROJECT_CONFIG[file]))
);

Object.keys(DATABASE_CONFIG).map((file) =>
  writeFileSync(file, stringify(DATABASE_CONFIG[file]))
);
