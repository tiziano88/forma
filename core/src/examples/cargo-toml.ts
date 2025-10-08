/**
 * Example schema: Cargo.toml (Rust package manifest)
 *
 * All keys (type names, field names, variant names) are opaque unique IDs.
 * Human-readable names and documentation live in the annotations export.
 */

import type { Schema, Annotations } from '../schema';
import { t } from '../schema';

// ---------------------------------------------------------------------------
// Opaque IDs — type definitions
// ---------------------------------------------------------------------------
const TY_CARGO_TOML = '02819575556077882937';
const TY_PACKAGE = '05042893047518923714';
const TY_DEPENDENCY_MAP = '10768141278253156287';
const TY_DEPENDENCY = '12899472045041081231';
const TY_WORKSPACE = '15459735044666288770';
const TY_LIB_TARGET = '09012815117838844049';
const TY_BIN_TARGET = '15578845193567429344';
const TY_PROFILES = '03258528379118497719';
const TY_PROFILE = '12616147036600435780';

// Opaque IDs — fields (CargoToml)
const F_CT_PACKAGE = '12355396447301696502';
const F_CT_DEPENDENCIES = '06800185074224152380';
const F_CT_DEV_DEPS = '07956208505712498840';
const F_CT_BUILD_DEPS = '01701877998896072020';
const F_CT_FEATURES = '00883546090232506666';
const F_CT_WORKSPACE = '08460088237878871347';
const F_CT_LIB = '08931468604273844150';
const F_CT_BIN = '04573984549363467280';
const F_CT_PROFILE = '03773142104560164116';
const F_CT_PATCH = '11730711072060315081';

// Opaque IDs — fields (Package)
const F_PK_NAME = '15898195853287574785';
const F_PK_VERSION = '18227814067250801166';
const F_PK_EDITION = '13571829790269584111';
const F_PK_AUTHORS = '06773869623044986810';
const F_PK_DESCRIPTION = '09908421362547679036';
const F_PK_LICENSE = '09214495311289701275';
const F_PK_REPOSITORY = '13024226065172454492';
const F_PK_HOMEPAGE = '15180820206862962349';
const F_PK_DOCUMENTATION = '12156576449212020835';
const F_PK_KEYWORDS = '14614483212564519479';
const F_PK_CATEGORIES = '16314501047327711960';
const F_PK_PUBLISH = '16673551910884891091';
const F_PK_DEFAULT_RUN = '15626391816898934345';
const F_PK_RUST_VERSION = '06900160272975274602';

// Opaque IDs — Dependency sum variants
const V_DEP_SIMPLE = '02235485674649236110';
const V_DEP_DETAILED = '16266646710097280023';

// Opaque IDs — fields (detailed dep)
const F_DEP_VERSION = '01732184591463155907';
const F_DEP_PATH = '05458883193392144549';
const F_DEP_GIT = '13810810843420411157';
const F_DEP_BRANCH = '01531093308563610173';
const F_DEP_FEATURES = '16958954366800318577';
const F_DEP_OPTIONAL = '14077814374150174519';
const F_DEP_DEFAULT_FEAT = '05171222777273287889';

// Opaque IDs — Workspace fields
const F_WS_MEMBERS = '11983451017257684748';
const F_WS_EXCLUDE = '10262427703195535270';
const F_WS_DEFAULT_MEMBERS = '16594690873712432268';
const F_WS_RESOLVER = '01648059392094315930';

// Opaque IDs — LibTarget / BinTarget fields
const F_LIB_NAME = '08812978004326467659';
const F_LIB_PATH = '03662156334974295319';
const F_LIB_CRATE_TYPE = '05032962286906361212';
const F_LIB_PROC_MACRO = '04524234172209743298';
const F_BIN_NAME = '13804074776904888237';
const F_BIN_PATH = '06779095603527828529';
const F_BIN_REQUIRED_FEAT = '12981479355552209892';
const F_BIN_BENCH = '04366903204669561870';

// Opaque IDs — Profile fields
const F_PROF_DEV = '11227139474203740167';
const F_PROF_RELEASE = '16478195255157932985';
const F_PROF_TEST = '09092428033001383296';
const F_PROF_OPT_LEVEL = '07777481094563680658';
const F_PROF_DEBUG = '15291863556465307189';
const F_PROF_LTO = '06367724814478524064';
const F_PROF_PANIC = '16961412638354117228';
const F_PROF_INCREMENTAL = '15700281827506021788';

// ---------------------------------------------------------------------------
// Schema definition (purely structural, opaque IDs)
// ---------------------------------------------------------------------------

export const cargoTomlSchema: Schema = {
  definitions: {
    [TY_CARGO_TOML]: t.product({
      [F_CT_PACKAGE]: t.field(t.optional(t.ref(TY_PACKAGE))),
      [F_CT_DEPENDENCIES]: t.field(t.optional(t.ref(TY_DEPENDENCY_MAP))),
      [F_CT_DEV_DEPS]: t.field(t.optional(t.ref(TY_DEPENDENCY_MAP))),
      [F_CT_BUILD_DEPS]: t.field(t.optional(t.ref(TY_DEPENDENCY_MAP))),
      [F_CT_FEATURES]: t.field(t.optional(t.map(t.string(), t.list(t.string())))),
      [F_CT_WORKSPACE]: t.field(t.optional(t.ref(TY_WORKSPACE))),
      [F_CT_LIB]: t.field(t.optional(t.ref(TY_LIB_TARGET))),
      [F_CT_BIN]: t.field(t.optional(t.list(t.ref(TY_BIN_TARGET)))),
      [F_CT_PROFILE]: t.field(t.optional(t.ref(TY_PROFILES))),
      [F_CT_PATCH]: t.field(t.optional(t.map(t.string(), t.ref(TY_DEPENDENCY_MAP)))),
    }),

    [TY_PACKAGE]: t.product({
      [F_PK_NAME]: t.field(t.string()),
      [F_PK_VERSION]: t.field(t.string()),
      [F_PK_EDITION]: t.field(t.optional(t.string())),
      [F_PK_AUTHORS]: t.field(t.optional(t.list(t.string()))),
      [F_PK_DESCRIPTION]: t.field(t.optional(t.string())),
      [F_PK_LICENSE]: t.field(t.optional(t.string())),
      [F_PK_REPOSITORY]: t.field(t.optional(t.string())),
      [F_PK_HOMEPAGE]: t.field(t.optional(t.string())),
      [F_PK_DOCUMENTATION]: t.field(t.optional(t.string())),
      [F_PK_KEYWORDS]: t.field(t.optional(t.list(t.string()))),
      [F_PK_CATEGORIES]: t.field(t.optional(t.list(t.string()))),
      [F_PK_PUBLISH]: t.field(t.optional(t.bool())),
      [F_PK_DEFAULT_RUN]: t.field(t.optional(t.string())),
      [F_PK_RUST_VERSION]: t.field(t.optional(t.string())),
    }),

    [TY_DEPENDENCY_MAP]: t.product({}), // map<string, Dependency> — modeled as a map type
    // Note: In practice this would be t.map(t.string(), t.ref(TY_DEPENDENCY)),
    // but we keep it simple here.

    [TY_DEPENDENCY]: t.sum({
      [V_DEP_SIMPLE]: t.variant(t.string()),
      [V_DEP_DETAILED]: t.variant(t.product({
        [F_DEP_VERSION]: t.field(t.optional(t.string())),
        [F_DEP_PATH]: t.field(t.optional(t.string())),
        [F_DEP_GIT]: t.field(t.optional(t.string())),
        [F_DEP_BRANCH]: t.field(t.optional(t.string())),
        [F_DEP_FEATURES]: t.field(t.optional(t.list(t.string()))),
        [F_DEP_OPTIONAL]: t.field(t.optional(t.bool())),
        [F_DEP_DEFAULT_FEAT]: t.field(t.optional(t.bool())),
      })),
    }),

    [TY_WORKSPACE]: t.product({
      [F_WS_MEMBERS]: t.field(t.optional(t.list(t.string()))),
      [F_WS_EXCLUDE]: t.field(t.optional(t.list(t.string()))),
      [F_WS_DEFAULT_MEMBERS]: t.field(t.optional(t.list(t.string()))),
      [F_WS_RESOLVER]: t.field(t.optional(t.string())),
    }),

    [TY_LIB_TARGET]: t.product({
      [F_LIB_NAME]: t.field(t.optional(t.string())),
      [F_LIB_PATH]: t.field(t.optional(t.string())),
      [F_LIB_CRATE_TYPE]: t.field(t.optional(t.list(t.string()))),
      [F_LIB_PROC_MACRO]: t.field(t.optional(t.bool())),
    }),

    [TY_BIN_TARGET]: t.product({
      [F_BIN_NAME]: t.field(t.string()),
      [F_BIN_PATH]: t.field(t.optional(t.string())),
      [F_BIN_REQUIRED_FEAT]: t.field(t.optional(t.list(t.string()))),
      [F_BIN_BENCH]: t.field(t.optional(t.bool())),
    }),

    [TY_PROFILES]: t.product({
      [F_PROF_DEV]: t.field(t.optional(t.ref(TY_PROFILE))),
      [F_PROF_RELEASE]: t.field(t.optional(t.ref(TY_PROFILE))),
      [F_PROF_TEST]: t.field(t.optional(t.ref(TY_PROFILE))),
    }),

    [TY_PROFILE]: t.product({
      [F_PROF_OPT_LEVEL]: t.field(t.optional(t.string())),
      [F_PROF_DEBUG]: t.field(t.optional(t.bool())),
      [F_PROF_LTO]: t.field(t.optional(t.string())),
      [F_PROF_PANIC]: t.field(t.optional(t.string())),
      [F_PROF_INCREMENTAL]: t.field(t.optional(t.bool())),
    }),
  },
  root: TY_CARGO_TOML,
};

// ---------------------------------------------------------------------------
// Annotations (display layer — human-readable names, docs, colors)
// ---------------------------------------------------------------------------

export const cargoTomlAnnotations: Annotations = {
  // Types
  [TY_CARGO_TOML]: { name: 'CargoToml', doc: 'Rust package manifest (Cargo.toml)' },
  [TY_PACKAGE]: { name: 'Package', doc: 'Package metadata section' },
  [TY_DEPENDENCY_MAP]: { name: 'DependencyMap', doc: 'Map of crate name → dependency spec' },
  [TY_DEPENDENCY]: { name: 'Dependency', doc: 'A single dependency specification' },
  [TY_WORKSPACE]: { name: 'Workspace', doc: 'Workspace configuration' },
  [TY_LIB_TARGET]: { name: 'LibTarget', doc: 'Library target configuration' },
  [TY_BIN_TARGET]: { name: 'BinTarget', doc: 'Binary target configuration' },
  [TY_PROFILES]: { name: 'Profiles', doc: 'Compiler profile configurations' },
  [TY_PROFILE]: { name: 'Profile', doc: 'A single compiler profile' },

  // CargoToml fields
  [F_CT_PACKAGE]: { name: 'package', doc: 'Package metadata' },
  [F_CT_DEPENDENCIES]: { name: 'dependencies', doc: 'Runtime dependencies' },
  [F_CT_DEV_DEPS]: { name: 'dev-dependencies', doc: 'Development-only dependencies' },
  [F_CT_BUILD_DEPS]: { name: 'build-dependencies', doc: 'Build script dependencies' },
  [F_CT_FEATURES]: { name: 'features', doc: 'Feature flags' },
  [F_CT_WORKSPACE]: { name: 'workspace', doc: 'Workspace configuration' },
  [F_CT_LIB]: { name: 'lib', doc: 'Library target' },
  [F_CT_BIN]: { name: 'bin', doc: 'Binary targets' },
  [F_CT_PROFILE]: { name: 'profile', doc: 'Compiler profiles' },
  [F_CT_PATCH]: { name: 'patch', doc: 'Dependency overrides by source' },

  // Package fields
  [F_PK_NAME]: { name: 'name', doc: 'Crate name' },
  [F_PK_VERSION]: { name: 'version', doc: 'Semver version' },
  [F_PK_EDITION]: { name: 'edition', doc: 'Rust edition ("2021", "2024")' },
  [F_PK_AUTHORS]: { name: 'authors', doc: 'Author list' },
  [F_PK_DESCRIPTION]: { name: 'description', doc: 'Short description' },
  [F_PK_LICENSE]: { name: 'license', doc: 'SPDX license expression' },
  [F_PK_REPOSITORY]: { name: 'repository', doc: 'Source repository URL' },
  [F_PK_HOMEPAGE]: { name: 'homepage' },
  [F_PK_DOCUMENTATION]: { name: 'documentation' },
  [F_PK_KEYWORDS]: { name: 'keywords', doc: 'Crate keywords for search' },
  [F_PK_CATEGORIES]: { name: 'categories', doc: 'Crate categories for crates.io' },
  [F_PK_PUBLISH]: { name: 'publish', doc: 'Whether to allow publishing' },
  [F_PK_DEFAULT_RUN]: { name: 'default-run', doc: 'Default binary to run' },
  [F_PK_RUST_VERSION]: { name: 'rust-version', doc: 'Minimum supported Rust version' },

  // Dependency variants
  [V_DEP_SIMPLE]: { name: 'simple', doc: 'Version string shorthand (e.g. "1.0")' },
  [V_DEP_DETAILED]: { name: 'detailed', doc: 'Detailed dependency with source and features' },

  // Detailed dependency fields
  [F_DEP_VERSION]: { name: 'version', doc: 'Semver version requirement' },
  [F_DEP_PATH]: { name: 'path', doc: 'Local path to dependency' },
  [F_DEP_GIT]: { name: 'git', doc: 'Git repository URL' },
  [F_DEP_BRANCH]: { name: 'branch', doc: 'Git branch' },
  [F_DEP_FEATURES]: { name: 'features', doc: 'Features to enable' },
  [F_DEP_OPTIONAL]: { name: 'optional', doc: 'Whether this is an optional dependency' },
  [F_DEP_DEFAULT_FEAT]: { name: 'default-features', doc: 'Whether to use default features' },

  // Workspace fields
  [F_WS_MEMBERS]: { name: 'members', doc: 'Workspace member globs' },
  [F_WS_EXCLUDE]: { name: 'exclude', doc: 'Excluded paths' },
  [F_WS_DEFAULT_MEMBERS]: { name: 'default-members', doc: 'Default members for commands' },
  [F_WS_RESOLVER]: { name: 'resolver', doc: 'Dependency resolver version' },

  // Lib target fields
  [F_LIB_NAME]: { name: 'name', doc: 'Library name' },
  [F_LIB_PATH]: { name: 'path', doc: 'Path to lib.rs' },
  [F_LIB_CRATE_TYPE]: { name: 'crate-type', doc: 'Crate types (lib, cdylib, etc.)' },
  [F_LIB_PROC_MACRO]: { name: 'proc-macro', doc: 'Whether this is a proc-macro crate' },

  // Bin target fields
  [F_BIN_NAME]: { name: 'name', doc: 'Binary name' },
  [F_BIN_PATH]: { name: 'path', doc: 'Path to main.rs' },
  [F_BIN_REQUIRED_FEAT]: { name: 'required-features', doc: 'Features required to build' },
  [F_BIN_BENCH]: { name: 'bench', doc: 'Whether to include in benchmarks' },

  // Profile fields
  [F_PROF_DEV]: { name: 'dev', doc: 'Development profile' },
  [F_PROF_RELEASE]: { name: 'release', doc: 'Release profile' },
  [F_PROF_TEST]: { name: 'test', doc: 'Test profile' },
  [F_PROF_OPT_LEVEL]: { name: 'opt-level', doc: 'Optimization level (0-3, s, z)' },
  [F_PROF_DEBUG]: { name: 'debug', doc: 'Debug info level' },
  [F_PROF_LTO]: { name: 'lto', doc: 'Link-time optimization' },
  [F_PROF_PANIC]: { name: 'panic', doc: 'Panic strategy (unwind or abort)' },
  [F_PROF_INCREMENTAL]: { name: 'incremental', doc: 'Enable incremental compilation' },
};
