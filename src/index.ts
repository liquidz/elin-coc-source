import {
  CompleteResult,
  CompleteOption,
  VimCompleteItem,
  ExtensionContext,
  sources,
  workspace,
} from "coc.nvim";

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
  const resp = await fetch(`http://localhost:${apiPort}/api/v1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method: "elin.handler.complete/complete",
      params: [input],
    }),
  });

  return await resp.json();
};
