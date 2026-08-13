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

async function fetchAccessToken(deviceCode) {
  try {
    const params = await checkDeviceFlowStatus(deviceCode);
    
    if (params.status === 'ready') {
      const response = await fetch(`https://github.com/login/oauth/access_token?client_id=${clientId}&device_code=${deviceCode}&grant_type=urn:ietf:params:oauth:grant-type:device_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.text();
        
        localStorage.setItem('token', new URLSearchParams(data).get('access_token'));
        
        return true;
      } else {
        throw new Error('Falha ao obter token.');
      }
    }

    return false;
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

export async function iniciarAutenticacao() {
    // Implementação da autenticação OAuth
    const response = await fetch('https://api.github.com/repos/username/repo/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: 'CLIENT_ID', scope: 'read:user' })
    });
    
    if (response.ok) {
        const data = await response.json();
        return data;
    } else {
        throw new Error('Erro ao iniciar autenticação');
    }
}

function checkStatusPeriodicamente(deviceCode) {
  let intervalId = setInterval(() => {
    checkDeviceFlowStatus(deviceCode).then(resultado => {
      if (resultado.status === 'ready') {
        console.log('Autenticação concluída!');
        
        clearInterval(intervalId); // Parar de verificar quando a autenticação é bem-sucedida
        fetchAccessToken(deviceCode);
      } else if (resultado.status !== 'pending') {
        clearInterval(intervalId); // Parar de verificar se houve erro na autenticação
        console.error('Erro na autenticação:', resultado.error_description);
      }
    });
  }, 5000);

  return intervalId;
}
