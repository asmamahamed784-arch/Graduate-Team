$ErrorActionPreference = 'Stop'

$BaseUrl = 'http://localhost:5001'
$Results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Endpoint,
    [string]$Method,
    [string]$Role,
    [string]$Status,
    [string]$Notes
  )
  $Results.Add([pscustomobject]@{
    Endpoint = $Endpoint
    Method = $Method
    Role = $Role
    Status = $Status
    Notes = $Notes
  })
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [string]$Token = $null,
    [string]$Role = 'Public',
    [string]$Label = $null,
    [int[]]$Expected = @(200, 201)
  )

  $headers = @{}
  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }

  $params = @{
    Uri = "$BaseUrl$Path"
    Method = $Method
    Headers = $headers
    UseBasicParsing = $true
  }
  if ($Body -ne $null) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 8)
  }

  $displayPath = $Path
  if ($Label) {
    $displayPath = $Label
  }

  try {
    $response = Invoke-WebRequest @params
    $code = [int]$response.StatusCode
    $json = $null
    if ($response.Content) {
      $json = $response.Content | ConvertFrom-Json
    }
    if ($Expected -contains $code) {
      Add-Result $displayPath $Method $Role 'Working' "HTTP $code"
    } else {
      Add-Result $displayPath $Method $Role 'Needs Fix' "Unexpected HTTP $code"
    }
    return @{ Code = $code; Data = $json }
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    $message = $_.Exception.Message
    if ($Expected -contains $code) {
      Add-Result $displayPath $Method $Role 'Working' "Expected HTTP $code"
    } else {
      Add-Result $displayPath $Method $Role 'Needs Fix' "HTTP $code $message"
    }
    return @{ Code = $code; Data = $null }
  }
}

function Login-Role {
  param([string]$Email, [string]$Password, [string]$Role)
  $res = Invoke-Api 'POST' '/api/auth/login' @{ email = $Email; password = $Password } $null $Role 'POST /api/auth/login'
  if ($res.Data -and $res.Data.success) {
    return $res.Data.data.token
  }
  return $null
}

$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Invoke-Api 'GET' '/' $null $null 'Public' 'GET /'
$servicesRes = Invoke-Api 'GET' '/api/services' $null $null 'Public' 'GET /api/services'
$centersRes = Invoke-Api 'GET' '/api/centers' $null $null 'Public' 'GET /api/centers'
Invoke-Api 'GET' '/api/settings/config' $null $null 'Public' 'GET /api/settings/config'
Invoke-Api 'GET' '/api/qr/generate?text=NQS-VERIFY' $null $null 'Public' 'GET /api/qr/generate'
Invoke-Api 'POST' '/api/contact' @{
  fullName = 'API Verification'
  email = "api.verify.$timestamp@nqs.com"
  subject = 'Endpoint Verification'
  message = 'Automated verification message from the NQS endpoint test suite.'
} $null 'Public' 'POST /api/contact'

$adminToken = Login-Role 'admin.nqs@gov.so' 'password123' 'Admin'
$operatorToken = Login-Role 'operator.nqs@gov.so' 'password123' 'Operator'
$citizenToken = Login-Role 'amina.ali@gov.so' 'password123' 'Citizen'

$registered = Invoke-Api 'POST' '/api/auth/register' @{
  name = 'Verification Citizen'
  email = "verify.citizen.$timestamp@nqs.com"
  phone = '+252 61 111 2222'
  password = 'password123'
  role = 'admin'
} $null 'Public' 'POST /api/auth/register'
if ($registered.Data -and $registered.Data.data.role -eq 'user') {
  Add-Result 'Public role escalation blocked' 'POST' 'Public' 'Working' 'Registered role forced to user'
} else {
  Add-Result 'Public role escalation blocked' 'POST' 'Public' 'Needs Fix' 'Public registration did not force user role'
}

if ($citizenToken) {
  Invoke-Api 'GET' '/api/auth/profile' $null $citizenToken 'Citizen' 'GET /api/auth/profile'
  Invoke-Api 'PUT' '/api/auth/profile' @{
    name = 'Amina Ali'
    email = 'amina.ali@gov.so'
    phone = '+252 61 000 0003'
  } $citizenToken 'Citizen' 'PUT /api/auth/profile'
  Invoke-Api 'GET' '/api/settings' $null $citizenToken 'Citizen' 'GET /api/settings'
  Invoke-Api 'PUT' '/api/settings' @{
    darkMode = $false
    language = 'en'
    notificationsEnabled = $true
    emailNotif = $true
    smsNotif = $true
    pushNotif = $true
    publicProfile = $true
    dataCollection = $false
  } $citizenToken 'Citizen' 'PUT /api/settings'
  Invoke-Api 'GET' '/api/notifications' $null $citizenToken 'Citizen' 'GET /api/notifications'
  Invoke-Api 'PUT' '/api/notifications/read-all' @{} $citizenToken 'Citizen' 'PUT /api/notifications/read-all'
  Invoke-Api 'GET' '/api/bookings/my' $null $citizenToken 'Citizen' 'GET /api/bookings/my'
  Invoke-Api 'GET' '/api/queue/list' $null $citizenToken 'Citizen' 'GET /api/queue/list'
  Invoke-Api 'GET' '/api/reports/stats' $null $citizenToken 'Citizen' 'GET /api/reports/stats forbidden' @(403)
}

$service = $servicesRes.Data.data | Select-Object -First 1
$center = $centersRes.Data.data | Select-Object -First 1
$createdBooking = $null

if ($service -and $center) {
  $bookingRes = Invoke-Api 'POST' '/api/bookings' @{
    serviceId = $service._id
    centerId = $center._id
    date = (Get-Date).ToString('yyyy-MM-dd')
    timeSlot = '09:00 AM'
  } $citizenToken 'Citizen' 'POST /api/bookings'
  $createdBooking = $bookingRes.Data.data
  if ($createdBooking) {
    Invoke-Api 'GET' "/api/bookings/$($createdBooking.ref)" $null $null 'Public' 'GET /api/bookings/:refOrId'
    Invoke-Api 'GET' "/api/queue/track/$($createdBooking.ref)" $null $null 'Public' 'GET /api/queue/track/:ref'
    Invoke-Api 'POST' '/api/qr/verify' @{ ticketRef = $createdBooking.ref } $operatorToken 'Operator' 'POST /api/qr/verify'
    Invoke-Api 'POST' '/api/activities/scan' @{ ticketRef = $createdBooking.ref } $operatorToken 'Operator' 'POST /api/activities/scan'
    Invoke-Api 'POST' '/api/feedback' @{ ticketId = $createdBooking._id; rating = 5; comment = 'Verification feedback' } $citizenToken 'Citizen' 'POST /api/feedback'
  }
  Invoke-Api 'GET' "/api/queue/live/$($center._id)" $null $null 'Public' 'GET /api/queue/live/:centerId'
}

if ($operatorToken -and $service -and $center) {
  Invoke-Api 'GET' '/api/reports/stats' $null $operatorToken 'Operator' 'GET /api/reports/stats'
  Invoke-Api 'POST' '/api/notifications' @{
    title = 'Verification Broadcast'
    desc = 'Automated notification verification.'
    category = 'System'
    sendEmail = $true
    sendSms = $true
  } $operatorToken 'Operator' 'POST /api/notifications'
  $walkInRes = Invoke-Api 'POST' '/api/queue/generate' @{
    serviceId = $service._id
    centerId = $center._id
    citizenName = 'Verification Walk In'
  } $operatorToken 'Operator' 'POST /api/queue/generate'
  $walkIn = $walkInRes.Data.data
  Invoke-Api 'POST' '/api/queue/call-next' @{ centerId = $center._id; counter = 'Counter 99' } $operatorToken 'Operator' 'POST /api/queue/call-next' @(200, 400)
  if ($walkIn) {
    Invoke-Api 'PUT' "/api/queue/$($walkIn._id)/hold" @{} $operatorToken 'Operator' 'PUT /api/queue/:id/hold'
    Invoke-Api 'PUT' "/api/queue/$($walkIn._id)/complete" @{} $operatorToken 'Operator' 'PUT /api/queue/:id/complete'
  }
}

if ($adminToken) {
  Invoke-Api 'GET' '/api/reports/stats' $null $adminToken 'Admin' 'GET /api/reports/stats'
  Invoke-Api 'GET' '/api/reports/analytics' $null $adminToken 'Admin' 'GET /api/reports/analytics'
  Invoke-Api 'GET' '/api/audits' $null $adminToken 'Admin' 'GET /api/audits'
  Invoke-Api 'GET' '/api/activities' $null $adminToken 'Admin' 'GET /api/activities'
  Invoke-Api 'GET' '/api/contact' $null $adminToken 'Admin' 'GET /api/contact'
  Invoke-Api 'GET' '/api/feedback' $null $adminToken 'Admin' 'GET /api/feedback'

  $newServiceRes = Invoke-Api 'POST' '/api/services' @{
    name = "Verification National ID Service $timestamp"
    description = 'Temporary National ID service for CRUD verification'
    category = 'National ID'
    duration = 12
    priority = 'Low'
    requirements = @('Verification ID')
  } $adminToken 'Admin' 'POST /api/services'
  $newService = $newServiceRes.Data.data
  if ($newService) {
    Invoke-Api 'GET' "/api/services/$($newService._id)" $null $null 'Public' 'GET /api/services/:id'
    Invoke-Api 'PUT' "/api/services/$($newService._id)" @{
      name = $newService.name
      description = 'Updated temporary service for CRUD verification'
      category = 'Verification'
      duration = 14
      priority = 'Medium'
      requirements = @('Updated ID')
    } $adminToken 'Admin' 'PUT /api/services/:id'
    Invoke-Api 'DELETE' "/api/services/$($newService._id)" $null $adminToken 'Admin' 'DELETE /api/services/:id'
  }

  $newCenterRes = Invoke-Api 'POST' '/api/centers' @{
    name = "Verification Center $timestamp"
    address = '123 Verification Road'
    city = 'Banaadir'
    phone = '+252 61 999 9999'
    counters = 2
    capacity = 25
    hours = '08:00 AM - 04:00 PM'
  } $adminToken 'Admin' 'POST /api/centers'
  $newCenter = $newCenterRes.Data.data
  if ($newCenter) {
    Invoke-Api 'GET' "/api/centers/$($newCenter._id)" $null $null 'Public' 'GET /api/centers/:id'
    Invoke-Api 'PUT' "/api/centers/$($newCenter._id)" @{
      name = $newCenter.name
      address = '456 Verification Road'
      city = 'Banaadir'
      phone = '+252 61 999 8888'
      counters = 3
      capacity = 30
      hours = '08:00 AM - 05:00 PM'
      status = 'Active'
    } $adminToken 'Admin' 'PUT /api/centers/:id'
    Invoke-Api 'DELETE' "/api/centers/$($newCenter._id)" $null $adminToken 'Admin' 'DELETE /api/centers/:id'
  }
}

$Results | Sort-Object Endpoint, Method | Format-Table -AutoSize
$failed = @($Results | Where-Object { $_.Status -ne 'Working' })
if ($failed.Count -gt 0) {
  Write-Host "`nFAILED ENDPOINTS:" -ForegroundColor Red
  $failed | Format-Table -AutoSize
  exit 1
}

Write-Host "`nAll verified endpoints are working." -ForegroundColor Green
