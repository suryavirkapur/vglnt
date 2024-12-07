import './App.css';
import DrivingRecorder from './components/SensorRecorder';
import SessionViewer from './components/SessionViewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';

const App = () => {
  return (
    <Tabs defaultValue="record">
      <TabsList>
        <TabsTrigger value="record">Record</TabsTrigger>
        <TabsTrigger value="view">View Sessions</TabsTrigger>
      </TabsList>
      <TabsContent value="record">
        <DrivingRecorder />
      </TabsContent>
      <TabsContent value="view">
        <SessionViewer />
      </TabsContent>
    </Tabs>
  );
};

export default App;
