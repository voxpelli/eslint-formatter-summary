/**
 * @param {NodeJS.ReadableStream & AsyncIterable<string | Buffer>} [stream]
 * @returns {Promise<string>}
 */
export default async function readStdin (stream = process.stdin) {
  let data = '';

  stream.setEncoding('utf8');

  for await (const chunk of stream) {
    data += String(chunk);
  }

  return data;
}
