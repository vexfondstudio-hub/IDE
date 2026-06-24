export function executeInSandbox(
  code: string,
  timeoutMs: number = 3000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const workerCode = `
      let logOutput = '';
      const originalLog = console.log;
      console.log = (...args) => {
        logOutput += args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\\n';
      };
      
      self.onmessage = function(e) {
        try {
          // Execute the code
          const execute = new Function(e.data.code);
          execute();
          self.postMessage({ type: 'success', output: logOutput });
        } catch (error) {
          self.postMessage({ type: 'error', error: error.toString(), output: logOutput });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    let isFinished = false;

    const timeout = setTimeout(() => {
      if (!isFinished) {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(
          new Error(
            `Execution timed out after ${timeoutMs}ms (Infinite loop?)`,
          ),
        );
      }
    }, timeoutMs);

    worker.onmessage = (e) => {
      isFinished = true;
      clearTimeout(timeout);
      URL.revokeObjectURL(workerUrl);
      if (e.data.type === "success") {
        resolve(e.data.output || "Executed successfully with no output.");
      } else {
        resolve(
          (e.data.output ? e.data.output + "\\n" : "") +
            "Error: " +
            e.data.error,
        );
      }
      worker.terminate();
    };

    worker.onerror = (error) => {
      isFinished = true;
      clearTimeout(timeout);
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`Worker error: ${error.message}`));
      worker.terminate();
    };

    worker.postMessage({ code });
  });
}
