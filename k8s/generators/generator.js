"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var _a, _b, _c, _d;
exports.__esModule = true;
var fs_1 = require("fs");
var yaml_1 = require("yaml");
var HOST_TYPE = process.env.HOST_TYPE;
var PROJECT_NAME = process.env.PROJECT_NAME;
var POSTGRES_USER = process.env.POSTGRES_USER;
var POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
var POSTGRES_INTERNAL_PORT = +(process.env.POSTGRES_INTERNAL_PORT || "5432");
var POSTGRES_PORT = +(process.env.POSTGRES_PORT || "5432");
var POSTGRES_DATABASE = process.env.POSTGRES_DATABASE || PROJECT_NAME;
var ROOT_POSTGRES_USER = process.env.ROOT_POSTGRES_USER || PROJECT_NAME + "_admin";
var ROOT_POSTGRES_PASSWORD = process.env.ROOT_POSTGRES_PASSWORD || POSTGRES_PASSWORD;
var DOCKER_STATIC_IMAGE = process.env.DOCKER_STATIC_IMAGE;
var DOCKER_SERVER_IMAGE = process.env.DOCKER_SERVER_IMAGE;
var LETSENCRYPT_EMAIL = process.env.LETSENCRYPT_EMAIL;
var PROJECT_DOMAIN = process.env.PROJECT_DOMAIN;
var PROJECT_SERVER_INGRESS_PATH = process.env.PROJECT_SERVER_INGRESS_PATH;
var PROJECT_STATIC_INGRESS_PATH = process.env.PROJECT_STATIC_INGRESS_PATH;
var PROJECT_STATIC_INGRESS_REWRITE_TARGET = process.env.PROJECT_STATIC_INGRESS_REWRITE_TARGET;
var PROJECT_CONFIG = (_a = {},
    _a["./k8s/" + HOST_TYPE + "/0.namespace.yaml"] = {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: {
            name: PROJECT_NAME + "-" + HOST_TYPE
        }
    },
    _a["./k8s/" + HOST_TYPE + "/1.configmap.yaml"] = {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: {
            namespace: PROJECT_NAME + "-" + HOST_TYPE,
            name: PROJECT_NAME + "-config"
        },
        data: {
            POSTGRES_URL: "postgres://" + POSTGRES_USER + ":" + POSTGRES_PASSWORD + "@postgres.postgres-" + process.env.HOST_TYPE + ":" + POSTGRES_INTERNAL_PORT + "/" + POSTGRES_DATABASE + "?schema=public"
        }
    },
    _a["./k8s/" + HOST_TYPE + "/2.static-deployment.yaml"] = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
            namespace: PROJECT_NAME + "-" + HOST_TYPE,
            name: PROJECT_NAME + "-static",
            labels: {
                app: PROJECT_NAME + "-static"
            }
        },
        spec: {
            replicas: 1,
            selector: {
                matchLabels: {
                    pod: PROJECT_NAME + "-static-container"
                }
            },
            template: {
                metadata: {
                    namespace: PROJECT_NAME + "-" + HOST_TYPE,
                    labels: {
                        pod: PROJECT_NAME + "-static-container"
                    }
                },
                spec: __assign({ containers: [
                        {
                            name: PROJECT_NAME + "-static",
                            image: DOCKER_STATIC_IMAGE,
                            imagePullPolicy: HOST_TYPE === "local" /* Local */ ? "Never" : "Always",
                            ports: [
                                {
                                    containerPort: 9090
                                },
                            ],
                            resources: {
                                requests: {
                                    memory: "64Mi",
                                    cpu: "250m"
                                },
                                limits: {
                                    memory: "128Mi",
                                    cpu: "500m"
                                }
                            }
                        },
                    ] }, (HOST_TYPE === "local" /* Local */
                    ? {}
                    : {
                        imagePullSecrets: [
                            {
                                name: "regcred"
                            },
                        ]
                    }))
            }
        }
    },
    _a["./k8s/" + HOST_TYPE + "/3.server-deployment.yaml"] = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
            namespace: PROJECT_NAME + "-" + HOST_TYPE,
            name: PROJECT_NAME + "-server",
            labels: {
                app: PROJECT_NAME + "-server"
            }
        },
        spec: {
            replicas: 1,
            selector: {
                matchLabels: {
                    pod: PROJECT_NAME + "-server-container"
                }
            },
            template: {
                metadata: {
                    namespace: PROJECT_NAME + "-" + HOST_TYPE,
                    labels: {
                        pod: PROJECT_NAME + "-server-container"
                    }
                },
                spec: __assign({ containers: [
                        {
                            name: PROJECT_NAME + "-server",
                            image: DOCKER_SERVER_IMAGE,
                            imagePullPolicy: HOST_TYPE === "local" /* Local */ ? "Never" : "Always",
                            ports: [
                                {
                                    containerPort: 5000
                                },
                            ],
                            envFrom: [
                                {
                                    configMapRef: {
                                        name: PROJECT_NAME + "-config"
                                    }
                                },
                            ],
                            resources: {
                                requests: {
                                    memory: "64Mi",
                                    cpu: "250m"
                                },
                                limits: {
                                    memory: "128Mi",
                                    cpu: "500m"
                                }
                            }
                        },
                    ] }, (HOST_TYPE === "local" /* Local */
                    ? {}
                    : {
                        imagePullSecrets: [
                            {
                                name: "regcred"
                            },
                        ]
                    }))
            }
        }
    },
    _a["./k8s/" + HOST_TYPE + "/4.static-service.yaml"] = {
        kind: "Service",
        apiVersion: "v1",
        metadata: {
            namespace: PROJECT_NAME + "-" + HOST_TYPE,
            name: PROJECT_NAME + "-static-service"
        },
        spec: {
            selector: {
                pod: PROJECT_NAME + "-static-container"
            },
            ports: [
                {
                    protocol: "TCP",
                    port: 9090,
                    targetPort: 9090
                },
            ],
            type: "ClusterIP"
        }
    },
    _a["./k8s/" + HOST_TYPE + "/5.server-service.yaml"] = {
        kind: "Service",
        apiVersion: "v1",
        metadata: {
            namespace: PROJECT_NAME + "-" + HOST_TYPE,
            name: PROJECT_NAME + "-server-service"
        },
        spec: {
            selector: {
                pod: PROJECT_NAME + "-server-container"
            },
            ports: [
                {
                    protocol: "TCP",
                    port: 5000,
                    targetPort: 5000
                },
            ],
            type: "ClusterIP"
        }
    },
    _a["./k8s/" + HOST_TYPE + "/6.issuer.yaml"] = {
        apiVersion: "cert-manager.io/v1alpha2",
        kind: "ClusterIssuer",
        metadata: {
            namespace: PROJECT_NAME + "-" + HOST_TYPE,
            name: "letsencrypt-" + HOST_TYPE
        },
        spec: {
            acme: {
                server: "https://acme-v02.api.letsencrypt.org/directory",
                email: LETSENCRYPT_EMAIL,
                privateKeySecretRef: {
                    name: "letsencrypt-" + HOST_TYPE
                },
                solvers: [
                    {
                        http01: {
                            ingress: {
                                "class": "nginx"
                            }
                        }
                    },
                ]
            }
        }
    },
    _a["./k8s/" + HOST_TYPE + "/7.server-ingress.yaml"] = {
        apiVersion: "networking.k8s.io/v1beta1",
        kind: "Ingress",
        metadata: {
            namespace: PROJECT_NAME + "-" + HOST_TYPE,
            name: PROJECT_NAME + "-server-ingress",
            annotations: (_b = {},
                _b["kubernetes.io/ingress.class"] = "nginx",
                _b["cert-manager.io/cluster-issuer"] = "letsencrypt-" + HOST_TYPE,
                _b["nginx.ingress.kubernetes.io/proxy-read-timeout"] = "1800",
                _b["nginx.ingress.kubernetes.io/proxy-send-timeout"] = "1800",
                _b["nginx.ingress.kubernetes.io/rewrite-target"] = "/api/$2",
                _b["nginx.ingress.kubernetes.io/secure-backends"] = "true",
                _b["nginx.ingress.kubernetes.io/ssl-redirect"] = "true",
                _b["nginx.ingress.kubernetes.io/websocket-services"] = PROJECT_NAME + "-server-service",
                _b["nginx.org/websocket-services"] = PROJECT_NAME + "-server-service",
                _b)
        },
        spec: {
            tls: [
                {
                    hosts: [PROJECT_DOMAIN],
                    secretName: "echo-tls"
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
                                    serviceName: PROJECT_NAME + "-server-service",
                                    servicePort: 5000
                                }
                            },
                        ]
                    }
                },
            ]
        }
    },
    _a["./k8s/" + HOST_TYPE + "/8.static-ingress.yaml"] = {
        apiVersion: "networking.k8s.io/v1beta1",
        kind: "Ingress",
        metadata: {
            namespace: PROJECT_NAME + "-" + HOST_TYPE,
            name: PROJECT_NAME + "-static-ingress",
            annotations: (_c = {},
                _c["kubernetes.io/ingress.class"] = "nginx",
                _c["cert-manager.io/cluster-issuer"] = "letsencrypt-" + HOST_TYPE,
                _c["nginx.ingress.kubernetes.io/proxy-read-timeout"] = "1800",
                _c["nginx.ingress.kubernetes.io/proxy-send-timeout"] = "1800",
                _c["nginx.ingress.kubernetes.io/rewrite-target"] = PROJECT_STATIC_INGRESS_REWRITE_TARGET,
                _c["nginx.ingress.kubernetes.io/secure-backends"] = "true",
                _c["nginx.ingress.kubernetes.io/ssl-redirect"] = "true",
                _c)
        },
        spec: {
            tls: [
                {
                    hosts: [PROJECT_DOMAIN],
                    secretName: "echo-tls"
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
                                    serviceName: PROJECT_NAME + "-static-service",
                                    servicePort: 9090
                                }
                            },
                        ]
                    }
                },
            ]
        }
    },
    _a);
var DATABASE_CONFIG = (_d = {},
    _d["./k8s/" + HOST_TYPE + "/postgres/services/global-service.yaml"] = {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
            namespace: "postgres-" + HOST_TYPE,
            name: PROJECT_NAME + "-global-postgres",
            labels: {
                app: "postgres"
            }
        },
        spec: {
            type: "NodePort",
            ports: [
                {
                    port: POSTGRES_INTERNAL_PORT,
                    nodePort: POSTGRES_PORT
                },
            ],
            selector: {
                app: "postgres"
            }
        }
    },
    _d["./k8s/" + HOST_TYPE + "/postgres/0.namespace.yaml"] = {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: {
            name: "postgres-" + HOST_TYPE
        }
    },
    _d["./k8s/" + HOST_TYPE + "/postgres/1.configmap.yaml"] = {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: {
            namespace: "postgres-" + HOST_TYPE,
            name: "postgres-config",
            labels: {
                app: "postgres"
            }
        },
        data: {
            POSTGRES_USER: ROOT_POSTGRES_USER,
            POSTGRES_PASSWORD: ROOT_POSTGRES_PASSWORD
        }
    },
    _d["./k8s/" + HOST_TYPE + "/postgres/2.storage.yaml"] = [
        {
            kind: "PersistentVolume",
            apiVersion: "v1",
            metadata: {
                namespace: "postgres-" + HOST_TYPE,
                name: "postgres-pv-volume",
                labels: {
                    type: "local",
                    app: "postgres"
                }
            },
            spec: {
                storageClassName: "manual",
                capacity: {
                    storage: "5Gi"
                },
                accessModes: ["ReadWriteMany"],
                hostPath: {
                    path: "/mnt/data"
                }
            }
        },
        {
            kind: "PersistentVolumeClaim",
            apiVersion: "v1",
            metadata: {
                namespace: "postgres-" + HOST_TYPE,
                name: "postgres-pv-claim",
                labels: {
                    app: "postgres"
                }
            },
            spec: {
                storageClassName: "manual",
                accessModes: ["ReadWriteMany"],
                resources: {
                    requests: {
                        storage: "5Gi"
                    }
                }
            }
        },
    ],
    _d["./k8s/" + HOST_TYPE + "/postgres/3.deployment.yaml"] = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
            namespace: "postgres-" + HOST_TYPE,
            name: "postgres"
        },
        spec: {
            replicas: 1,
            selector: {
                matchLabels: {
                    pod: "postgres-container"
                }
            },
            template: {
                metadata: {
                    namespace: "postgres-" + HOST_TYPE,
                    labels: {
                        app: "postgres",
                        pod: "postgres-container"
                    }
                },
                spec: {
                    containers: [
                        {
                            name: "postgres",
                            image: "postgres:12",
                            imagePullPolicy: "IfNotPresent",
                            ports: [
                                {
                                    containerPort: POSTGRES_INTERNAL_PORT
                                },
                            ],
                            envFrom: [
                                {
                                    configMapRef: {
                                        name: "postgres-config"
                                    }
                                },
                            ],
                            volumeMounts: [
                                {
                                    mountPath: "/var/lib/postgresql/data",
                                    name: "postgredb"
                                },
                            ],
                            resources: {
                                requests: {
                                    memory: "64Mi",
                                    cpu: "250m"
                                },
                                limits: {
                                    memory: "128Mi",
                                    cpu: "500m"
                                }
                            }
                        },
                    ],
                    volumes: [
                        {
                            name: "postgredb",
                            persistentVolumeClaim: {
                                claimName: "postgres-pv-claim"
                            }
                        },
                    ]
                }
            }
        }
    },
    _d["./k8s/" + HOST_TYPE + "/postgres/4.service.yaml"] = {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
            namespace: "postgres-" + HOST_TYPE,
            name: "postgres",
            labels: {
                app: "postgres"
            }
        },
        spec: {
            selector: {
                app: 'postgres'
            },
            ports: [
                {
                    protocol: 'TCP',
                    port: POSTGRES_INTERNAL_PORT,
                    targetPort: POSTGRES_INTERNAL_PORT
                },
            ],
            type: 'ClusterIP'
        }
    },
    _d);
Object.keys(PROJECT_CONFIG).map(function (file) {
    return fs_1.writeFileSync(file, yaml_1.stringify(PROJECT_CONFIG[file]));
});
Object.keys(DATABASE_CONFIG).map(function (file) {
    return fs_1.writeFileSync(file, Array.isArray(DATABASE_CONFIG[file])
        ? DATABASE_CONFIG[file].map(function (v) { return yaml_1.stringify(v); }).join("---\n")
        : yaml_1.stringify(DATABASE_CONFIG[file]));
});