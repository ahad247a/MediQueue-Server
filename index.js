const express = require('express');
const app = express();
const PORT = 5000;

// সার্ভার ঠিকঠাক কাজ করছে কি না তা চেক করার জন্য একটা বেসিক রাস্তা (Route)
app.get('/', (req, res) => {
    res.send('আমাদের এক্সপ্রেস সার্ভার সফলভাবে রান করছে!');
});

// সার্ভারকে চালু করা
app.listen(PORT, () => {
    console.log(`সার্ভার চলছে এই লিঙ্কে: http://localhost:${PORT}`);
});