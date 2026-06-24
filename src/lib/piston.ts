import axios from "axios";

const WANDBOX_COMPILERS: Record<string, string> = {
  python: 'cpython-3.12.7',
  cpp: 'gcc-13.2.0',
  java: 'openjdk-jdk-22+36',
  csharp: 'dotnetcore-8.0.402',
  rust: 'rust-1.82.0',
  lua: 'lua-5.4.7'
};

export interface PistonLanguage {
  language: string;
  version: string;
  aliases: string[];
}

export async function getRuntimes(): Promise<PistonLanguage[]> {
  return []; // Not needed with Wandbox approach
}

export async function executeCode(
  language: string,
  version: string,
  code: string,
): Promise<any> {
  try {
    const response = await axios.post("https://wandbox.org/api/compile.json", {
      code,
      compiler: WANDBOX_COMPILERS[language] || "cpython-3.12.7",
    });
    const data = response.data;
    const output = data.program_message || data.compiler_message || data.program_error || data.compiler_error || "";
    
    return {
      run: {
        output: output,
      },
      compile: {
        output: data.compiler_message || "",
      },
    };
  } catch (error: any) {
    console.error("Error executing code:", error);
    if (error.response && error.response.data) {
       return {
         run: {
           output: error.response.data.program_message || error.response.data.compiler_message || error.message
         }
       };
    }
    throw error;
  }
}
