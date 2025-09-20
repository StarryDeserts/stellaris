export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = 'https://foxhole.bot' + endpoint;

  // Create headers with Authorization if we have a token
  const headers = new Headers(options.headers || {});


  // Update options with the headers
  const updatedOptions = {
    ...options,
    headers,
  };

  const response = await fetch(url, updatedOptions);

  return response;
}
