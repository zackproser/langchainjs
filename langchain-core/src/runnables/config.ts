import {
  type BaseCallbackConfig,
  CallbackManager,
} from "../callbacks/manager.js";

export const DEFAULT_RECURSION_LIMIT = 25;

export interface RunnableConfig extends BaseCallbackConfig {
  /**
   * Runtime values for attributes previously made configurable on this Runnable,
   * or sub-Runnables.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configurable?: Record<string, any>;

  /**
   * Maximum number of times a call can recurse. If not provided, defaults to 25.
   */
  recursionLimit?: number;

  /** Maximum number of parallel calls to make. */
  maxConcurrency?: number;
}

export async function getCallbackManagerForConfig(config?: RunnableConfig) {
  return CallbackManager.configure(
    config?.callbacks,
    undefined,
    config?.tags,
    undefined,
    config?.metadata
  );
}

export function mergeConfigs<CallOptions extends RunnableConfig>(
  config: RunnableConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Record<string, any>
): Partial<CallOptions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const copy: Record<string, any> = { ...config };
  if (options) {
    for (const key of Object.keys(options)) {
      if (key === "metadata") {
        copy[key] = { ...copy[key], ...options[key] };
      } else if (key === "tags") {
        copy[key] = (copy[key] ?? []).concat(options[key] ?? []);
      } else if (key === "configurable") {
        copy[key] = { ...copy[key], ...options[key] };
      } else if (key === "callbacks") {
        const baseCallbacks = copy.callbacks;
        const providedCallbacks = options.callbacks ?? config.callbacks;
        // callbacks can be either undefined, Array<handler> or manager
        // so merging two callbacks values has 6 cases
        if (Array.isArray(providedCallbacks)) {
          if (!baseCallbacks) {
            copy.callbacks = providedCallbacks;
          } else if (Array.isArray(baseCallbacks)) {
            copy.callbacks = baseCallbacks.concat(providedCallbacks);
          } else {
            // baseCallbacks is a manager
            const manager = baseCallbacks.copy();
            for (const callback of providedCallbacks) {
              manager.addHandler(callback, true);
            }
            copy.callbacks = manager;
          }
        } else if (providedCallbacks) {
          // providedCallbacks is a manager
          if (!baseCallbacks) {
            copy.callbacks = providedCallbacks;
          } else if (Array.isArray(baseCallbacks)) {
            const manager = providedCallbacks.copy();
            for (const callback of baseCallbacks) {
              manager.addHandler(callback, true);
            }
            copy.callbacks = manager;
          } else {
            // baseCallbacks is also a manager
            copy.callbacks = new CallbackManager(
              providedCallbacks.parentRunId,
              {
                handlers: baseCallbacks.handlers.concat(
                  providedCallbacks.handlers
                ),
                inheritableHandlers: baseCallbacks.inheritableHandlers.concat(
                  providedCallbacks.inheritableHandlers
                ),
                tags: Array.from(
                  new Set(baseCallbacks.tags.concat(providedCallbacks.tags))
                ),
                inheritableTags: Array.from(
                  new Set(
                    baseCallbacks.inheritableTags.concat(
                      providedCallbacks.inheritableTags
                    )
                  )
                ),
                metadata: {
                  ...baseCallbacks.metadata,
                  ...providedCallbacks.metadata,
                },
              }
            );
          }
        }
      } else {
        copy[key] = options[key] ?? copy[key];
      }
    }
  }
  return copy as Partial<CallOptions>;
}

/**
 * Ensure that a passed config is an object with all required keys present.
 */
export function ensureConfig<CallOptions extends RunnableConfig>(
  config?: CallOptions
): Partial<CallOptions> {
  return {
    tags: [],
    metadata: {},
    callbacks: undefined,
    recursionLimit: 25,
    ...config,
  } as Partial<CallOptions>;
}

/**
 * Helper function that patches runnable configs with updated properties.
 */
export function patchConfig<CallOptions extends RunnableConfig>(
  config: Partial<CallOptions> = {},
  {
    callbacks,
    maxConcurrency,
    recursionLimit,
    runName,
    configurable,
  }: RunnableConfig = {}
): Partial<CallOptions> {
  const newConfig = ensureConfig(config);
  if (callbacks !== undefined) {
    /**
     * If we're replacing callbacks we need to unset runName
     * since that should apply only to the same run as the original callbacks
     */
    delete newConfig.runName;
    newConfig.callbacks = callbacks;
  }
  if (recursionLimit !== undefined) {
    newConfig.recursionLimit = recursionLimit;
  }
  if (maxConcurrency !== undefined) {
    newConfig.maxConcurrency = maxConcurrency;
  }
  if (runName !== undefined) {
    newConfig.runName = runName;
  }
  if (configurable !== undefined) {
    newConfig.configurable = { ...newConfig.configurable, ...configurable };
  }
  return newConfig;
}
