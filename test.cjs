const axios = require('axios');
axios.post('https://wandbox.org/api/compile.json', {
    code: 'class Main { public static void main(String[] args) { System.out.println("Hello Wandbox!"); } }',
    compiler: 'openjdk-jdk-22+36'
}).then(res => console.log(res.data)).catch(e => console.error(e.response ? e.response.data : e.message));
