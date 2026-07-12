import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  center: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: true },
  lastNumber: { type: Number, default: 0 },
  prefix: { type: String, default: 'NQS' }
});

const Counter = mongoose.model('Counter', CounterSchema);
export default Counter;
