# CI utility node. No host socket or host application directory is mounted.
ARG DIND_IMAGE=docker:29-dind
FROM ${DIND_IMAGE}
RUN apk add --no-cache bash python3 curl
