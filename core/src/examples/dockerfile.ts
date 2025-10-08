/**
 * Example schema: Dockerfile
 *
 * All keys (type names, field names, variant names) are opaque unique IDs.
 * Human-readable names and documentation live in the annotations export.
 */

import type { Schema, Annotations } from '../schema';
import { t } from '../schema';

// ---------------------------------------------------------------------------
// Opaque IDs — type definitions
// ---------------------------------------------------------------------------
const TY_DOCKERFILE   = '17179420619785472214';
const TY_INSTRUCTION  = '09284031062437652961';
const TY_MOUNT        = '05440648377978126521';

// Opaque IDs — Instruction variants
const V_FROM          = '17088947394227385770';
const V_RUN           = '15080453986178898808';
const V_COPY          = '02685174794910886517';
const V_ADD           = '14523466578335477425';
const V_ENV           = '16428054309559319813';
const V_ARG           = '10940313757363065385';
const V_WORKDIR       = '08818168299192012296';
const V_EXPOSE        = '14256930799768346938';
const V_CMD           = '01016846901914253778';
const V_ENTRYPOINT    = '11309386281324166655';
const V_LABEL         = '09983402485635657963';
const V_USER          = '18148626339411325213';
const V_VOLUME        = '17524404635086081445';
const V_HEALTHCHECK   = '16203912090867181181';
const V_SHELL         = '14935400695866964785';
const V_STOPSIGNAL    = '09474093102419413299';

// Opaque IDs — Mount variants
const V_MOUNT_BIND    = '17452190384032034201';
const V_MOUNT_CACHE   = '16899253740648587651';
const V_MOUNT_SECRET  = '10786738000219841988';
const V_MOUNT_SSH     = '00106866593688428989';

// Opaque IDs — FROM fields
const F_FROM_IMAGE    = '11838274317213478524';
const F_FROM_AS       = '09788642721682007971';
const F_FROM_PLATFORM = '07469668789290227635';

// Opaque IDs — RUN fields
const F_RUN_COMMAND   = '02394875663077519422';
const F_RUN_MOUNT     = '10966907499427559526';

// Opaque IDs — COPY / ADD fields
const F_COPY_SRC      = '10156335316805114020';
const F_COPY_DST      = '04507305574674855292';
const F_COPY_FROM     = '00070423219170061222';
const F_COPY_CHOWN    = '02173207435427172757';
const F_COPY_CHMOD    = '13431099724543831455';
const F_ADD_SRC       = '07689912402115797091';
const F_ADD_DST       = '13773565328643738159';
const F_ADD_CHOWN     = '16105563634015771471';
const F_ADD_CHMOD     = '16497718537047701801';

// Opaque IDs — ENV / ARG / WORKDIR
const F_ENV_VARS      = '11786421237174285824';
const F_ARG_NAME      = '16864478475093387740';
const F_ARG_DEFAULT   = '10791976527056877767';
const F_WORKDIR_PATH  = '16375842402494319522';

// Opaque IDs — EXPOSE / CMD / ENTRYPOINT / LABEL
const F_EXPOSE_PORT   = '17627553076883788812';
const F_EXPOSE_PROTO  = '00950118661900432437';
const F_CMD_ARGS      = '06068383208155475331';
const F_ENTRY_ARGS    = '12882792017747450323';
const F_LABEL_LABELS  = '16925489022595534510';

// Opaque IDs — USER / VOLUME / SHELL / STOPSIGNAL
const F_USER_USER     = '00678495829448692758';
const F_USER_GROUP    = '16045784535642127197';
const F_VOL_PATHS     = '07321758996849652927';
const F_SHELL_ARGS    = '14288713592952114655';
const F_STOP_SIGNAL   = '03523833568706403998';

// Opaque IDs — HEALTHCHECK fields
const F_HC_COMMAND    = '11396975195960974167';
const F_HC_INTERVAL   = '11838452749502267275';
const F_HC_TIMEOUT    = '01287579330538692146';
const F_HC_RETRIES    = '07320696575589961694';

// Opaque IDs — Mount fields
const F_BIND_SOURCE   = '02905184469740768967';
const F_BIND_TARGET   = '04285520175736241367';
const F_CACHE_TARGET  = '13247531999124462097';
const F_CACHE_SHARING = '08992644964141883518';
const F_SECRET_ID     = '13154822265649556433';
const F_SECRET_TARGET = '03538211204390815893';
const F_SSH_ID        = '15049543016895831157';

// ---------------------------------------------------------------------------
// Schema definition (purely structural, opaque IDs)
// ---------------------------------------------------------------------------

export const dockerfileSchema: Schema = {
  definitions: {
    [TY_DOCKERFILE]: t.list(t.ref(TY_INSTRUCTION)),

    [TY_INSTRUCTION]: t.sum({
      [V_FROM]: t.variant(t.product({
        [F_FROM_IMAGE]:    t.field(t.string()),
        [F_FROM_AS]:       t.field(t.optional(t.string())),
        [F_FROM_PLATFORM]: t.field(t.optional(t.string())),
      })),
      [V_RUN]: t.variant(t.product({
        [F_RUN_COMMAND]: t.field(t.string()),
        [F_RUN_MOUNT]:   t.field(t.optional(t.list(t.ref(TY_MOUNT)))),
      })),
      [V_COPY]: t.variant(t.product({
        [F_COPY_SRC]:   t.field(t.list(t.string())),
        [F_COPY_DST]:   t.field(t.string()),
        [F_COPY_FROM]:  t.field(t.optional(t.string())),
        [F_COPY_CHOWN]: t.field(t.optional(t.string())),
        [F_COPY_CHMOD]: t.field(t.optional(t.string())),
      })),
      [V_ADD]: t.variant(t.product({
        [F_ADD_SRC]:   t.field(t.list(t.string())),
        [F_ADD_DST]:   t.field(t.string()),
        [F_ADD_CHOWN]: t.field(t.optional(t.string())),
        [F_ADD_CHMOD]: t.field(t.optional(t.string())),
      })),
      [V_ENV]: t.variant(t.product({
        [F_ENV_VARS]: t.field(t.map(t.string(), t.string())),
      })),
      [V_ARG]: t.variant(t.product({
        [F_ARG_NAME]:    t.field(t.string()),
        [F_ARG_DEFAULT]: t.field(t.optional(t.string())),
      })),
      [V_WORKDIR]: t.variant(t.product({
        [F_WORKDIR_PATH]: t.field(t.string()),
      })),
      [V_EXPOSE]: t.variant(t.product({
        [F_EXPOSE_PORT]:  t.field(t.uint32()),
        [F_EXPOSE_PROTO]: t.field(t.optional(t.string())),
      })),
      [V_CMD]: t.variant(t.product({
        [F_CMD_ARGS]: t.field(t.list(t.string())),
      })),
      [V_ENTRYPOINT]: t.variant(t.product({
        [F_ENTRY_ARGS]: t.field(t.list(t.string())),
      })),
      [V_LABEL]: t.variant(t.product({
        [F_LABEL_LABELS]: t.field(t.map(t.string(), t.string())),
      })),
      [V_USER]: t.variant(t.product({
        [F_USER_USER]:  t.field(t.string()),
        [F_USER_GROUP]: t.field(t.optional(t.string())),
      })),
      [V_VOLUME]: t.variant(t.product({
        [F_VOL_PATHS]: t.field(t.list(t.string())),
      })),
      [V_HEALTHCHECK]: t.variant(t.product({
        [F_HC_COMMAND]:  t.field(t.optional(t.string())),
        [F_HC_INTERVAL]: t.field(t.optional(t.string())),
        [F_HC_TIMEOUT]:  t.field(t.optional(t.string())),
        [F_HC_RETRIES]:  t.field(t.optional(t.uint32())),
      })),
      [V_SHELL]: t.variant(t.product({
        [F_SHELL_ARGS]: t.field(t.list(t.string())),
      })),
      [V_STOPSIGNAL]: t.variant(t.product({
        [F_STOP_SIGNAL]: t.field(t.string()),
      })),
    }),

    [TY_MOUNT]: t.sum({
      [V_MOUNT_BIND]: t.variant(t.product({
        [F_BIND_SOURCE]: t.field(t.optional(t.string())),
        [F_BIND_TARGET]: t.field(t.string()),
      })),
      [V_MOUNT_CACHE]: t.variant(t.product({
        [F_CACHE_TARGET]:  t.field(t.string()),
        [F_CACHE_SHARING]: t.field(t.optional(t.string())),
      })),
      [V_MOUNT_SECRET]: t.variant(t.product({
        [F_SECRET_ID]:     t.field(t.string()),
        [F_SECRET_TARGET]: t.field(t.optional(t.string())),
      })),
      [V_MOUNT_SSH]: t.variant(t.product({
        [F_SSH_ID]: t.field(t.optional(t.string())),
      })),
    }),
  },
  root: TY_DOCKERFILE,
};

// ---------------------------------------------------------------------------
// Annotations (display layer)
// ---------------------------------------------------------------------------

export const dockerfileAnnotations: Annotations = {
  // Types
  [TY_DOCKERFILE]:  { name: 'Dockerfile', doc: 'Ordered list of build instructions' },
  [TY_INSTRUCTION]: { name: 'Instruction', doc: 'A single Dockerfile instruction' },
  [TY_MOUNT]:       { name: 'Mount', doc: 'Build-time mount for RUN --mount' },

  // Instruction variants
  [V_FROM]:       { name: 'FROM', doc: 'Set the base image for a new build stage' },
  [V_RUN]:        { name: 'RUN', doc: 'Execute a command during the build' },
  [V_COPY]:       { name: 'COPY', doc: 'Copy files from the build context or a stage' },
  [V_ADD]:        { name: 'ADD', doc: 'Add files, URLs, or archives' },
  [V_ENV]:        { name: 'ENV', doc: 'Set environment variables' },
  [V_ARG]:        { name: 'ARG', doc: 'Define a build argument' },
  [V_WORKDIR]:    { name: 'WORKDIR', doc: 'Set the working directory' },
  [V_EXPOSE]:     { name: 'EXPOSE', doc: 'Declare a listening port' },
  [V_CMD]:        { name: 'CMD', doc: 'Default command for the container' },
  [V_ENTRYPOINT]: { name: 'ENTRYPOINT', doc: 'Container entrypoint' },
  [V_LABEL]:      { name: 'LABEL', doc: 'Add metadata labels' },
  [V_USER]:       { name: 'USER', doc: 'Set the user for subsequent instructions' },
  [V_VOLUME]:     { name: 'VOLUME', doc: 'Create mount points' },
  [V_HEALTHCHECK]:{ name: 'HEALTHCHECK', doc: 'Container health check' },
  [V_SHELL]:      { name: 'SHELL', doc: 'Override default shell' },
  [V_STOPSIGNAL]: { name: 'STOPSIGNAL', doc: 'Signal to stop the container' },

  // Mount variants
  [V_MOUNT_BIND]:   { name: 'bind', doc: 'Bind mount from build context' },
  [V_MOUNT_CACHE]:  { name: 'cache', doc: 'Cache mount for build dependencies' },
  [V_MOUNT_SECRET]: { name: 'secret', doc: 'Mount a build secret' },
  [V_MOUNT_SSH]:    { name: 'ssh', doc: 'Mount SSH agent socket' },

  // FROM fields
  [F_FROM_IMAGE]:    { name: 'image', doc: 'Base image name (e.g. "ubuntu:22.04")' },
  [F_FROM_AS]:       { name: 'as', doc: 'Stage name for multi-stage builds' },
  [F_FROM_PLATFORM]: { name: 'platform', doc: 'Target platform (e.g. "linux/amd64")' },

  // RUN fields
  [F_RUN_COMMAND]: { name: 'command', doc: 'Shell command to execute' },
  [F_RUN_MOUNT]:   { name: 'mount', doc: 'Build-time mounts' },

  // COPY fields
  [F_COPY_SRC]:   { name: 'src', doc: 'Source paths' },
  [F_COPY_DST]:   { name: 'dst', doc: 'Destination path in the image' },
  [F_COPY_FROM]:  { name: 'from', doc: 'Source stage name (multi-stage)' },
  [F_COPY_CHOWN]: { name: 'chown', doc: 'Owner:group for copied files' },
  [F_COPY_CHMOD]: { name: 'chmod', doc: 'Permissions for copied files' },

  // ADD fields
  [F_ADD_SRC]:   { name: 'src', doc: 'Source paths or URLs' },
  [F_ADD_DST]:   { name: 'dst', doc: 'Destination path in the image' },
  [F_ADD_CHOWN]: { name: 'chown' },
  [F_ADD_CHMOD]: { name: 'chmod' },

  // ENV / ARG / WORKDIR
  [F_ENV_VARS]:     { name: 'vars', doc: 'Environment variable key-value pairs' },
  [F_ARG_NAME]:     { name: 'name', doc: 'Argument name' },
  [F_ARG_DEFAULT]:  { name: 'default', doc: 'Default value' },
  [F_WORKDIR_PATH]: { name: 'path', doc: 'Working directory path' },

  // EXPOSE / CMD / ENTRYPOINT / LABEL
  [F_EXPOSE_PORT]:  { name: 'port', doc: 'Port number' },
  [F_EXPOSE_PROTO]: { name: 'protocol', doc: '"tcp" or "udp"' },
  [F_CMD_ARGS]:     { name: 'args', doc: 'Default command arguments (exec form)' },
  [F_ENTRY_ARGS]:   { name: 'args', doc: 'Container entrypoint (exec form)' },
  [F_LABEL_LABELS]: { name: 'labels', doc: 'Metadata key-value pairs' },

  // USER / VOLUME / SHELL / STOPSIGNAL
  [F_USER_USER]:  { name: 'user', doc: 'Username or UID' },
  [F_USER_GROUP]: { name: 'group', doc: 'Group name or GID' },
  [F_VOL_PATHS]:  { name: 'paths', doc: 'Mount point paths' },
  [F_SHELL_ARGS]: { name: 'args', doc: 'Default shell (e.g. ["/bin/bash", "-c"])' },
  [F_STOP_SIGNAL]:{ name: 'signal', doc: 'Signal to send for container stop (e.g. "SIGTERM")' },

  // HEALTHCHECK fields
  [F_HC_COMMAND]:  { name: 'command', doc: 'Health check command (null = NONE)' },
  [F_HC_INTERVAL]: { name: 'interval', doc: 'Time between checks (e.g. "30s")' },
  [F_HC_TIMEOUT]:  { name: 'timeout', doc: 'Check timeout' },
  [F_HC_RETRIES]:  { name: 'retries', doc: 'Consecutive failures to report unhealthy' },

  // Mount fields
  [F_BIND_SOURCE]:  { name: 'source' },
  [F_BIND_TARGET]:  { name: 'target' },
  [F_CACHE_TARGET]: { name: 'target' },
  [F_CACHE_SHARING]:{ name: 'sharing', doc: '"shared", "private", or "locked"' },
  [F_SECRET_ID]:    { name: 'id' },
  [F_SECRET_TARGET]:{ name: 'target' },
  [F_SSH_ID]:       { name: 'id' },
};

// Re-export IDs for use in tests and value construction
export const ids = {
  TY_DOCKERFILE, TY_INSTRUCTION, TY_MOUNT,
  V_FROM, V_RUN, V_COPY, V_ADD, V_ENV, V_ARG, V_WORKDIR, V_EXPOSE,
  V_CMD, V_ENTRYPOINT, V_LABEL, V_USER, V_VOLUME, V_HEALTHCHECK, V_SHELL, V_STOPSIGNAL,
  V_MOUNT_BIND, V_MOUNT_CACHE, V_MOUNT_SECRET, V_MOUNT_SSH,
  F_FROM_IMAGE, F_FROM_AS, F_FROM_PLATFORM,
  F_RUN_COMMAND, F_RUN_MOUNT,
  F_COPY_SRC, F_COPY_DST, F_COPY_FROM, F_COPY_CHOWN, F_COPY_CHMOD,
  F_ADD_SRC, F_ADD_DST, F_ADD_CHOWN, F_ADD_CHMOD,
  F_ENV_VARS, F_ARG_NAME, F_ARG_DEFAULT, F_WORKDIR_PATH,
  F_EXPOSE_PORT, F_EXPOSE_PROTO, F_CMD_ARGS, F_ENTRY_ARGS, F_LABEL_LABELS,
  F_USER_USER, F_USER_GROUP, F_VOL_PATHS, F_SHELL_ARGS, F_STOP_SIGNAL,
  F_HC_COMMAND, F_HC_INTERVAL, F_HC_TIMEOUT, F_HC_RETRIES,
  F_BIND_SOURCE, F_BIND_TARGET, F_CACHE_TARGET, F_CACHE_SHARING,
  F_SECRET_ID, F_SECRET_TARGET, F_SSH_ID,
} as const;
