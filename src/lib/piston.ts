import axios from 'axios';

const PISTON_API = 'https://emkc.org/api/v2/piston';

export interface PistonLanguage {
  language: string;
  version: string;
  aliases: string[];
}

export async function getRuntimes(): Promise<PistonLanguage[]> {
  try {
    const response = await axios.get(`${PISTON_API}/runtimes`);
    return response.data;
  } catch (error) {
    console.error('Error fetching runtimes:', error);
    return [];
  }
}

export async function executeCode(language: string, version: string, code: string): Promise<any> {
  try {
    const response = await axios.post(`${PISTON_API}/execute`, {
      language,
      version,
      files: [
        {
          name: 'main',
          content: code,
        },
      ],
      stdin: '',
      args: [],
      compile_timeout: 10000,
      run_timeout: 3000,
      compile_memory_limit: -1,
      run_memory_limit: -1,
    });
    return response.data;
  } catch (error) {
    console.error('Error executing code:', error);
    throw error;
  }
}
