const axios = require('axios');

const BASE_URL = 'https://www.vajraaudit.me';

const randomEmail = `testuser_${Math.floor(Math.random() * 100000)}@example.com`;
const password = 'password123';
const uniqueId = `unique_${Math.floor(Math.random() * 100000)}`;
const tokensToAdd = 100;

const testUser = {
    name: 'Test User',
    company: 'Test Company',
    email: randomEmail,
    password: password,
    uniqueId: uniqueId
};

let authToken = '';

async function registerUser() {
    try {
        const response = await axios.post(`${BASE_URL}/api/register`, testUser);
        console.log('Registration successful:', response.data);
    } catch (error) {
        console.error('Registration failed:', error.response ? error.response.data : error.message);
    }
}

async function loginUser() {
    try {
        const response = await axios.post(`${BASE_URL}/api/login`, {
            email: testUser.email,
            password: testUser.password
        });
        console.log('Login successful:', response.data);
        authToken = response.data.token;
    } catch (error) {
        console.error('Login failed:', error.response ? error.response.data : error.message);
    }
}

async function updateTokens() {
    try {
        const response = await axios.post(`${BASE_URL}/api/update-tokens`,
            { amount: tokensToAdd },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        console.log('Token update successful:', response.data);
    } catch (error) {
        console.error('Token update failed:', error.response ? error.response.data : error.message);
    }
}

async function getUser() {
    try {
        const response = await axios.get(`${BASE_URL}/api/user`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('Get user successful:', response.data);

        if (response.data.tokens === tokensToAdd) {
            console.log('Token update verified.');
        } else {
            console.error('Token update verification failed.');
        }

    } catch (error) {
        console.error('Get user failed:', error.response ? error.response.data : error.message);
    }
}


async function runTests() {
    await registerUser();
    await loginUser();
    await updateTokens();
    await getUser();
}

runTests();