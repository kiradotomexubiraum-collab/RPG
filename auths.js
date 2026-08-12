const clientId = 'SEU_CLIENT_ID';

async function startDeviceFlow() {
  try {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'read:user'
      })
    });

    if (response.ok) {
      const data = await response.json();
      
      console.log(`Acesse ${data.verification_uri} e insira o código: ${data.user_code}`);
      
      return data;
    } else {
      throw new Error('Falha ao iniciar autenticação.');
    }
  } catch (error) {
    console.error('Erro:', error);
  }
}

async function checkDeviceFlowStatus(deviceCode) {
  try {
    const response = await fetch('https://github.com/login/device/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    });

    if (response.ok) {
      const data = await response.json();
      
      return data;
    } else {
      throw new Error('Falha ao verificar status da autenticação.');
    }
  } catch (error) {
    console.error('Erro:', error);
  }
}

async function getAccessToken(deviceCode) {
  try {
    const params = await fetchAccessToken(deviceCode);
    
    localStorage.setItem('token', params.get('access_token'));
    
    return true;
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

async function fetchAccessToken(deviceCode) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  });

  if (response.ok) {
    const data = await response.text();
    
    return new URLSearchParams(data);
  } else {
    throw new Error('Falha ao obter token de acesso.');
  }
}

export async function iniciarAutenticacao() {
  const resultado = await startDeviceFlow();
  
  if (resultado) {
    console.log(`Acesse ${resultado.verification_uri} e insira o código: ${resultado.user_code}`);
    
    // Verificar periodicamente o status da autenticação
