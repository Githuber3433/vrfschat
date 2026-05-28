const fs = require('fs');
const path = require('path');

const CHAT_DB = path.join(__dirname, '../../chat.json');

function getChatHistory() {
    if (!fs.existsSync(CHAT_DB)) {
        fs.writeFileSync(CHAT_DB, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(CHAT_DB));
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    return {
        statusCode: 200,
        body: JSON.stringify(getChatHistory()),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    };
};
