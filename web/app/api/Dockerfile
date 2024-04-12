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
COPY ./app/api/requirements.txt .
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

# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]