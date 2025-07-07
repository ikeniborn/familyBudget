###############
# BUILD IMAGE #
###############
FROM python:3.9 AS build

# virtualenv
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# install dependencies
RUN apt-get update
RUN apt-get install -y python3-pip gcc make jq openssl

# add and install requirements
RUN pip install pip --upgrade
COPY ./api/requirements.txt .
RUN pip install -r requirements.txt

#################
# RUNTIME IMAGE #
#################
FROM python:3.9 AS runtime

# setup user and group ids
ARG USER_ID=1000
ENV USER_ID $USER_ID
ARG GROUP_ID=1000
ENV GROUP_ID $GROUP_ID

# add non-root user and give permissions to workdir
RUN groupadd --gid $GROUP_ID user && \
          adduser user --ingroup user --gecos '' --disabled-password --uid $USER_ID && \
          mkdir -p /usr/src/app && \
          chown -R user:user /usr/src/app

# copy from build image
COPY --chown=user:user --from=build /opt/venv /opt/venv

# set working directory
WORKDIR /usr/src/app

# switch to non-root user
USER user

# disables lag in stdout/stderr output
ENV PYTHONUNBUFFERED 1
ENV PYTHONDONTWRITEBYTECODE 1
# Path
ENV PATH="/opt/venv/bin:$PATH"

# Default to secure API, can be overridden with SECURE_API=false
ENV SECURE_API=true

# Copy application files
COPY --chown=user:user ./api .

# Start command - uses environment variable to select API version
CMD sh -c 'if [ "$SECURE_API" = "true" ]; then \
    uvicorn budget_api_secure:app --host 0.0.0.0 --port 8888; \
  else \
    uvicorn budget_api:app --host 0.0.0.0 --port 8888; \
  fi'