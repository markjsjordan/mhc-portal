import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Caregiver Training & Certification Dashboard
 *
 * Comprehensive training and certification tracking system for caregivers.
 * Ensures compliance, tracks expirations, and provides career development pathways.
 */

interface Certification {
  id: string;
  name: string;
  type: 'required' | 'optional' | 'specialty';
  status: 'active' | 'expiring-soon' | 'expired';
  issuedDate: string;
  expirationDate: string;
  issuer: string;
  certificateUrl?: string;
  daysUntilExpiration: number;
}

interface Training {
  id: string;
  title: string;
  category: string;
  duration: string;
  format: 'online' | 'in-person' | 'hybrid';
  status: 'not-started' | 'in-progress' | 'completed';
  progress: number;
  dueDate?: string;
  certificationType?: string;
}

interface UpcomingSession {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  instructor: string;
  spotsLeft: number;
  isEnrolled: boolean;
}

const DEMO_CERTIFICATIONS: Certification[] = [
  {
    id: '1',
    name: 'CPR & First Aid',
    type: 'required',
    status: 'active',
    issuedDate: '2024-01-15',
    expirationDate: '2026-01-15',
    issuer: 'American Red Cross',
    daysUntilExpiration: 395,
  },
  {
    id: '2',
    name: 'Home Health Aide (HHA)',
    type: 'required',
    status: 'active',
    issuedDate: '2023-06-01',
    expirationDate: '2025-06-01',
    issuer: 'Texas DSHS',
    daysUntilExpiration: 177,
  },
  {
    id: '3',
    name: 'Dementia Care Specialist',
    type: 'specialty',
    status: 'expiring-soon',
    issuedDate: '2023-02-10',
    expirationDate: '2025-02-10',
    issuer: 'Alzheimer\'s Association',
    daysUntilExpiration: 66,
  },
  {
    id: '4',
    name: 'Medication Administration',
    type: 'required',
    status: 'expiring-soon',
    issuedDate: '2023-03-20',
    expirationDate: '2025-03-20',
    issuer: 'Texas DSHS',
    daysUntilExpiration: 104,
  },
  {
    id: '5',
    name: 'Diabetes Management',
    type: 'specialty',
    status: 'active',
    issuedDate: '2024-05-10',
    expirationDate: '2026-05-10',
    issuer: 'American Diabetes Association',
    daysUntilExpiration: 520,
  },
  {
    id: '6',
    name: 'Infection Control',
    type: 'required',
    status: 'expired',
    issuedDate: '2022-11-01',
    expirationDate: '2024-11-01',
    issuer: 'CDC Training',
    daysUntilExpiration: -35,
  },
];

const DEMO_TRAININGS: Training[] = [
  {
    id: '1',
    title: 'Advanced Wound Care',
    category: 'Clinical Skills',
    duration: '4 hours',
    format: 'online',
    status: 'in-progress',
    progress: 65,
    dueDate: '2025-01-15',
  },
  {
    id: '2',
    title: 'Cultural Competency in Care',
    category: 'Professional Development',
    duration: '2 hours',
    format: 'online',
    status: 'not-started',
    progress: 0,
    dueDate: '2025-01-30',
  },
  {
    id: '3',
    title: 'Fall Prevention Strategies',
    category: 'Safety',
    duration: '3 hours',
    format: 'hybrid',
    status: 'not-started',
    progress: 0,
  },
  {
    id: '4',
    title: 'Nutrition for Seniors',
    category: 'Health & Wellness',
    duration: '2.5 hours',
    format: 'online',
    status: 'completed',
    progress: 100,
  },
];

const UPCOMING_SESSIONS: UpcomingSession[] = [
  {
    id: '1',
    title: 'CPR Recertification',
    date: '2025-01-10',
    time: '9:00 AM - 12:00 PM',
    location: 'Main Office Training Room',
    instructor: 'Sarah Johnson, RN',
    spotsLeft: 3,
    isEnrolled: true,
  },
  {
    id: '2',
    title: 'Dementia Care Best Practices',
    date: '2025-01-17',
    time: '2:00 PM - 5:00 PM',
    location: 'Community Center',
    instructor: 'Dr. Michael Chen',
    spotsLeft: 8,
    isEnrolled: false,
  },
  {
    id: '3',
    title: 'HIPAA Compliance Update',
    date: '2025-01-24',
    time: '10:00 AM - 11:30 AM',
    location: 'Virtual (Zoom)',
    instructor: 'Legal Team',
    spotsLeft: 15,
    isEnrolled: false,
  },
];

const COURSE_CATALOG = [
  {
    category: 'Required Certifications',
    courses: [
      { title: 'Home Health Aide Certification', duration: '40 hours', format: 'In-Person' },
      { title: 'CPR & First Aid', duration: '4 hours', format: 'In-Person' },
      { title: 'Medication Administration', duration: '16 hours', format: 'Hybrid' },
      { title: 'Infection Control', duration: '2 hours', format: 'Online' },
    ],
  },
  {
    category: 'Specialty Certifications',
    courses: [
      { title: 'Dementia Care Specialist', duration: '12 hours', format: 'Online' },
      { title: 'Diabetes Management', duration: '8 hours', format: 'Online' },
      { title: 'Hospice & Palliative Care', duration: '16 hours', format: 'Hybrid' },
      { title: 'Wound Care Specialist', duration: '10 hours', format: 'Online' },
    ],
  },
  {
    category: 'Professional Development',
    courses: [
      { title: 'Cultural Competency', duration: '2 hours', format: 'Online' },
      { title: 'Communication Skills', duration: '3 hours', format: 'Online' },
      { title: 'Stress Management', duration: '1.5 hours', format: 'Online' },
      { title: 'Leadership for Caregivers', duration: '6 hours', format: 'Hybrid' },
    ],
  },
];

export default function CaregiverTrainingDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'certifications' | 'training' | 'catalog'>('overview');
  const [_selectedCert, setSelectedCert] = useState<Certification | null>(null);

  const certStats = {
    total: DEMO_CERTIFICATIONS.length,
    active: DEMO_CERTIFICATIONS.filter((c) => c.status === 'active').length,
    expiringSoon: DEMO_CERTIFICATIONS.filter((c) => c.status === 'expiring-soon').length,
    expired: DEMO_CERTIFICATIONS.filter((c) => c.status === 'expired').length,
  };

  const trainingStats = {
    inProgress: DEMO_TRAININGS.filter((t) => t.status === 'in-progress').length,
    completed: DEMO_TRAININGS.filter((t) => t.status === 'completed').length,
    notStarted: DEMO_TRAININGS.filter((t) => t.status === 'not-started').length,
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active':
        return 'default';
      case 'expiring-soon':
        return 'secondary';
      case 'expired':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Training & Certifications</h1>
        <p className="text-gray-600">Track your certifications, complete training, and advance your career</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { id: 'overview' as const, label: 'Overview', icon: '📊' },
          { id: 'certifications' as const, label: 'My Certifications', icon: '🎓' },
          { id: 'training' as const, label: 'My Training', icon: '📚' },
          { id: 'catalog' as const, label: 'Course Catalog', icon: '📖' },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            onClick={() => setActiveTab(tab.id)}
            className="gap-2"
          >
            <span>{tab.icon}</span>
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-green-700">{certStats.active}</div>
                <div className="text-sm font-medium text-green-600 mt-1">Active Certifications</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-amber-700">{certStats.expiringSoon}</div>
                <div className="text-sm font-medium text-amber-600 mt-1">Expiring Soon</div>
                <div className="text-xs text-amber-600">(within 90 days)</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-red-700">{certStats.expired}</div>
                <div className="text-sm font-medium text-red-600 mt-1">Expired</div>
                <div className="text-xs text-red-600">(needs renewal)</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-blue-700">{trainingStats.inProgress}</div>
                <div className="text-sm font-medium text-blue-600 mt-1">Trainings In Progress</div>
              </CardContent>
            </Card>
          </div>

          {/* Action Items */}
          <Card>
            <CardHeader>
              <CardTitle>⚠️ Action Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {certStats.expired > 0 && (
                <div className="flex items-start gap-4 p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl">🚨</div>
                  <div className="flex-1">
                    <div className="font-semibold">Renew Expired Certifications</div>
                    <div className="text-sm text-gray-600">
                      You have {certStats.expired} expired certification(s). Renew immediately to continue working.
                    </div>
                  </div>
                  <Button>Renew Now</Button>
                </div>
              )}
              {certStats.expiringSoon > 0 && (
                <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-lg">
                  <div className="text-2xl">⏰</div>
                  <div className="flex-1">
                    <div className="font-semibold">Certifications Expiring Soon</div>
                    <div className="text-sm text-gray-600">
                      {certStats.expiringSoon} certification(s) expire within 90 days. Schedule renewals now.
                    </div>
                  </div>
                  <Button variant="outline">View Details</Button>
                </div>
              )}
              {trainingStats.inProgress > 0 && (
                <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl">📚</div>
                  <div className="flex-1">
                    <div className="font-semibold">Complete In-Progress Training</div>
                    <div className="text-sm text-gray-600">
                      Finish your {trainingStats.inProgress} pending training course(s) to earn certifications.
                    </div>
                  </div>
                  <Button variant="outline">Continue</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>📅 Upcoming Training Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {UPCOMING_SESSIONS.map((session) => (
                <Card key={session.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-semibold">{session.title}</div>
                      {session.isEnrolled && (
                        <Badge variant="default" className="bg-green-600">✓ Enrolled</Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <div>📅 {new Date(session.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                      <div>🕐 {session.time}</div>
                      <div>📍 {session.location}</div>
                      <div>👨‍🏫 {session.instructor}</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">{session.spotsLeft} spots left</div>
                      {!session.isEnrolled && (
                        <Button>Enroll Now</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Certifications Tab */}
      {activeTab === 'certifications' && (
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Certifications</CardTitle>
              <Button>+ Upload Certificate</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {DEMO_CERTIFICATIONS.map((cert) => (
                  <Card
                    key={cert.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedCert(cert)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-2xl">
                          {cert.type === 'required' && '⭐'}
                          {cert.type === 'specialty' && '🏆'}
                          {cert.type === 'optional' && '📋'}
                        </div>
                        <Badge variant={getStatusBadgeVariant(cert.status)}>
                          {cert.status === 'active' && '✓ Active'}
                          {cert.status === 'expiring-soon' && '⏰ Expiring Soon'}
                          {cert.status === 'expired' && '⚠️ Expired'}
                        </Badge>
                      </div>
                      <div className="font-semibold mb-1">{cert.name}</div>
                      <div className="text-sm text-gray-600 mb-3">{cert.issuer}</div>
                      <div className="border-t pt-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Issued:</span>
                          <span>{new Date(cert.issuedDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Expires:</span>
                          <span>{new Date(cert.expirationDate).toLocaleDateString()}</span>
                        </div>
                        {cert.status !== 'expired' && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Days left:</span>
                            <span className={`font-semibold ${cert.daysUntilExpiration < 90 ? 'text-amber-600' : 'text-green-600'}`}>
                              {cert.daysUntilExpiration}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        {cert.status === 'expiring-soon' || cert.status === 'expired' ? (
                          <Button className="w-full" variant="destructive">Renew Now</Button>
                        ) : (
                          <Button className="w-full" variant="outline">View Certificate</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Training Tab */}
      {activeTab === 'training' && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle>My Training Courses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {DEMO_TRAININGS.map((training) => (
                <Card key={training.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold">{training.title}</div>
                        <div className="text-sm text-gray-600">
                          <span>{training.category}</span>
                          <span> • {training.duration}</span>
                          <span> • {training.format === 'online' ? '💻' : training.format === 'in-person' ? '🏫' : '🔄'} {training.format}</span>
                        </div>
                      </div>
                      {training.status === 'completed' && (
                        <Badge variant="default" className="bg-green-600">✓ Completed</Badge>
                      )}
                    </div>

                    {training.status !== 'completed' && (
                      <div className="my-3">
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${training.progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500">{training.progress}% Complete</div>
                      </div>
                    )}

                    {training.dueDate && (
                      <div className="text-sm text-gray-600 mb-3">
                        Due: {new Date(training.dueDate).toLocaleDateString()}
                      </div>
                    )}

                    <Button
                      className="w-full"
                      variant={training.status === 'not-started' ? 'default' : 'outline'}
                    >
                      {training.status === 'not-started' ? 'Start Course' : training.status === 'in-progress' ? 'Continue' : 'View Certificate'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Catalog Tab */}
      {activeTab === 'catalog' && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Course Catalog</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Browse available courses to advance your skills and earn certifications
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {COURSE_CATALOG.map((category, idx) => (
                <div key={idx}>
                  <h3 className="text-lg font-semibold mb-3">{category.category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {category.courses.map((course, courseIdx) => (
                      <Card key={courseIdx} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4 text-center">
                          <div className="text-3xl mb-2">
                            {category.category === 'Required Certifications' ? '⭐' :
                             category.category === 'Specialty Certifications' ? '🏆' : '📚'}
                          </div>
                          <div className="font-semibold mb-2">{course.title}</div>
                          <div className="text-xs text-gray-600 mb-3">
                            <span>{course.duration}</span>
                            <span> • </span>
                            <span>{course.format}</span>
                          </div>
                          <Button className="w-full">Enroll</Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
