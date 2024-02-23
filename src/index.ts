import {
  CompleteResult,
  CompleteOption,
  VimCompleteItem,
  ExtensionContext,
  sources,
  workspace,
} from "coc.nvim";

const FETCH_TIMEOUT_MILLI_SEC = 500 as const;
let cachedApiPort: number | undefined = undefined;

export const activate = async (context: ExtensionContext): Promise<void> => {
  context.subscriptions.push(
    sources.createSource({
      name: "coc-elin completion source", // unique id
      doComplete: async (opt: CompleteOption) => {
        const apiPort = await getApiPort();
        if (apiPort == null) {
          return { items: [] };
        }
        return await getCompletionResult(opt, apiPort);
      },
    })
  );
};

const getApiPort = async (): Promise<number | undefined> => {
  if (cachedApiPort != null) {
    return cachedApiPort;
  }

  const apiPort = await workspace.nvim.eval("g:elin_http_server_port");
  if (apiPort == null || typeof apiPort !== "number") {
    return undefined;
  }
  cachedApiPort = apiPort;
  return apiPort;
};

const getCompletionResult = async (
  opt: CompleteOption,
  apiPort: number
): Promise<CompleteResult> => {
  const items = (await fetchCompletionItems(apiPort, opt.input)).map(
    (item) => ({ ...item, menu: "[elin]" })
  );
  return { items: items };
};

const fetchCompletionItems = async (
  apiPort: number,
  input: string
): Promise<VimCompleteItem[]> => {
  const resp = await fetchCompletionResponse(apiPort, input);
  if (resp == null) {
    return [];
  }
  return await resp.json();
};

const fetchCompletionResponse = async (
  apiPort: number,
  input: string,
  retrying: boolean = false
): Promise<Response | undefined> => {
  const resp = await fetchWithTimeout(
    FETCH_TIMEOUT_MILLI_SEC,
    `http://localhost:${apiPort}/api/v1`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "elin.handler.complete/complete",
        params: [input],
      }),
    }
  ).catch(async () => {
    cachedApiPort = undefined;
    if (retrying) {
      return undefined;
    }
    const newPort = await getApiPort();
    if (newPort == null) {
      return undefined;
    }
    return await fetchCompletionResponse(newPort, input, true);
  });

  return resp;
};

const fetchWithTimeout = (
  timeoutMilliSec: number,
  input: RequestInfo | URL,
  init?: RequestInit | undefined
) => Promise.race([tryFetch(input, init), timeoutPromise(timeoutMilliSec)]);

const tryFetch = (
  input: RequestInfo | URL,
  init?: RequestInit | undefined
): Promise<Response> =>
  fetch(input, init).then((resp: Response) => {
    if (resp.status !== 200) {
      throw Error(`Failed to fetch: ${resp.status}`);
    }
    return Promise.resolve(resp);
  });

const timeoutPromise = (timeoutMilliSec: number): Promise<Response> =>
  new Promise((_, reject) => {
    setTimeout(() => {
      reject(Error("Timed out"));
    }, timeoutMilliSec);
  });
